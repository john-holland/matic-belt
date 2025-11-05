import * as dotenv from 'dotenv';
dotenv.config();

import express, { Request, Response } from 'express';
import { createServer } from 'http';
import { Server, Socket } from 'socket.io';
import { Octokit } from '@octokit/rest';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { OpenAI } from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { chromium } from 'playwright';
import { SpeechTracker } from './speech-tracker';
import { WeatherTimeService } from './services/weather-time';
import { AutoLogEvent } from './types/auto-log-event';
import { AudioChat, AudioChatMessage } from './audio-chat';
import { HistoryManager } from './history-manager';
import { WiFiManagerWDUtil } from './wifi-wdutil';
import * as path from 'path';

interface AIUser {
    id: string;
    type: string;
    credits: number;
    friends: string[];
}

interface MUDMessage {
    type: 'system' | 'error' | 'success' | 'ai';
    content: string;
    timestamp: number;
    sender?: string;
}

class MUDServer {
    private app = express();
    private server = createServer(this.app);
    private io = new Server(this.server);
    private octokit: Octokit | null = null;
    private gemini: GoogleGenerativeAI | null = null;
    private openai: OpenAI | null = null;
    private anthropic: Anthropic | null = null;
    private aiUsers: Map<string, AIUser> = new Map();
    private speechTracker: SpeechTracker;
    private weatherTimeService: WeatherTimeService;
    private audioChat: AudioChat;
    private historyManager: HistoryManager;
    // Conversation history per user (socket.id) - keeps last 20 messages for context
    private conversationHistory: Map<string, Array<{ role: string; content: string }>> = new Map();
    private wifiManager: WiFiManagerWDUtil | null = null;
    private wifiInitialized: boolean = false;
    private wifiScanInterval: NodeJS.Timeout | null = null;
    // Pending GitHub searches waiting for user confirmation
    private pendingGitHubSearches: Map<string, { 
        aiType: string; 
        query: string; 
        userId: string;
        originalResponse: string;
        credits: number;
    }> = new Map();

    constructor() {
        this.initializeGitHub();
        this.initializeAI();
        this.initializeWiFi();
        this.initializeAIUsers(); // Initialize AI users at startup
        this.speechTracker = new SpeechTracker();
        this.weatherTimeService = new WeatherTimeService();
        this.audioChat = new AudioChat();
        this.historyManager = new HistoryManager();
        this.setupSocketHandlers();
        this.setupRoutes();
    }

    private async initializeWiFi() {
        try {
            if (process.platform !== 'darwin') {
                console.warn('⚠️ wdutil is only available on macOS. WiFi scanning may not work on other platforms.');
                this.wifiInitialized = false;
                return;
            }

            // Check if running with sudo (for wdutil access)
            const isRoot = process.getuid && process.getuid() === 0;
            
            this.wifiManager = new WiFiManagerWDUtil(isRoot);
            await this.wifiManager.initialize();
            this.wifiInitialized = true;
            console.log('✅ WiFi initialized successfully with wdutil');
        } catch (error: any) {
            console.error('⚠️ Failed to initialize WiFi:', error.message);
            console.error('   Hint: Run with sudo for wdutil access: sudo npm start');
            this.wifiInitialized = false;
        }
    }

    private async initializeGitHub() {
        try {
            if (process.env.GITHUB_TOKEN) {
                this.octokit = new Octokit({
                    auth: process.env.GITHUB_TOKEN
                });
            }
        } catch (error) {
            console.warn('⚠️ GitHub not initialized (optional):', error);
        }
    }

    private async initializeAI() {
        try {
            // Initialize Gemini (optional)
            if (process.env.GEMINI_API_KEY) {
                this.gemini = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
            }
        } catch (error) {
            console.warn('⚠️ Gemini not initialized (optional):', error);
        }

        try {
            // Initialize OpenAI (optional)
            if (process.env.OPENAI_API_KEY) {
                this.openai = new OpenAI({
                    apiKey: process.env.OPENAI_API_KEY
                });
            }
        } catch (error) {
            console.warn('⚠️ OpenAI not initialized (optional):', error);
        }

        try {
            // Initialize Anthropic (optional)
            if (process.env.ANTHROPIC_API_KEY) {
                this.anthropic = new Anthropic({
                    apiKey: process.env.ANTHROPIC_API_KEY
                });
            }
        } catch (error) {
            console.warn('⚠️ Anthropic not initialized (optional):', error);
        }

        try {
            // Initialize Playwright browser (optional)
            // Browser can be used for web scraping if needed
            await chromium.launch();
        } catch (error) {
            console.warn('⚠️ Playwright browser not initialized (optional):', error);
        }
    }

    private setupSocketHandlers() {
        this.io.on('connection', (socket: Socket) => {
            console.log('Client connected:', socket.id);

            socket.on('initialize', () => {
                this.handleInitialize(socket);
            });

            socket.on('command', async (command: string) => {
                // Save command to history (unless it's a history command itself)
                if (!command.startsWith('!history')) {
                    this.historyManager.addCommand(command);
                }
                await this.handleCommand(socket, command);
            });

            socket.on('get-history', () => {
                const history = this.historyManager.getHistory();
                socket.emit('history-response', { history });
            });

            // Handle GitHub search confirmation
            socket.on('confirm-github-search', (data: { searchId: string; confirmed: boolean }) => {
                this.handleGitHubSearchConfirmation(socket, data.searchId, data.confirmed);
            });

            socket.on('speech', async (data: { userId: string, content: string, context?: Record<string, any> }) => {
                try {
                    const entry = await this.speechTracker.trackSpeech(data.userId, data.content, data.context);
                    socket.emit('speech_tracked', {
                        id: entry.id,
                        timestamp: entry.timestamp
                    });

                    // Handle audio chat messages
                    await this.audioChat.handleMessage(data.userId, data.content);

                    // Set up auto-log event listener for this socket
                    const autoLogHandler = (event: AutoLogEvent) => {
                        let message: MUDMessage | undefined;
                        switch (event.type) {
                            case 'weather':
                                message = {
                                    type: 'system',
                                    content: `🌤️ Current weather in ${event.data.city}: ${event.data.temperature}°C, ${event.data.description}. Humidity: ${event.data.humidity}%, Wind: ${event.data.windSpeed} m/s`,
                                    timestamp: event.timestamp
                                };
                                break;
                            case 'time':
                                message = {
                                    type: 'system',
                                    content: `🕒 Current time (${event.data.timezone}): ${event.data.currentTime}`,
                                    timestamp: event.timestamp
                                };
                                break;
                            case 'weather-time':
                                message = {
                                    type: 'system',
                                    content: `🌤️ Weather in ${event.data.weather.city}: ${event.data.weather.temperature}°C, ${event.data.weather.description}\n🕒 Time (${event.data.time.timezone}): ${event.data.time.currentTime}`,
                                    timestamp: event.timestamp
                                };
                                break;
                        }
                        if (message) {
                            socket.emit('message', message);
                        }
                    };

                    // Add the event listener
                    this.speechTracker.on('autoLog', autoLogHandler);

                    // Remove the event listener when the socket disconnects
                    socket.on('disconnect', () => {
                        this.speechTracker.removeListener('autoLog', autoLogHandler);
                    });
                } catch (error) {
                    socket.emit('error', { message: 'Failed to track speech' });
                }
            });

            // Set up audio chat message handler
            this.audioChat.on('message', (message: AudioChatMessage) => {
                socket.emit('audio_message', message);
            });

            socket.on('wifi:start-scanning', (data?: { interval?: number }) => {
                if (!this.wifiInitialized || !this.wifiManager) {
                    socket.emit('wifi:error', { 
                        message: 'WiFi not initialized. Run with sudo for wdutil access: sudo npm start' 
                    });
                    return;
                }
                
                // Start periodic scanning
                if (this.wifiScanInterval) {
                    clearInterval(this.wifiScanInterval);
                }
                
                // Use provided interval or default to 5 seconds
                const interval = (data?.interval || 5) * 1000;
                
                const scanAndEmit = async () => {
                    try {
                        console.log('📡 Scanning WiFi networks with wdutil...');
                        const networks = await this.wifiManager!.scan();
                        
                        console.log(`✅ WiFi scan found ${networks.length} networks`);
                        if (networks.length === 0) {
                            console.warn('⚠️ No networks found. Make sure:');
                            console.warn('   1. WiFi is enabled on your Mac');
                            console.warn('   2. Server is running with sudo (if needed)');
                            console.warn('   3. Location Services are enabled (System Preferences > Security & Privacy)');
                        } else {
                            networks.forEach(net => {
                                console.log(`   📶 ${net.ssid} - ${net.signal_level} dBm (Channel ${net.channel})`);
                            });
                        }
                        
                        socket.emit('wifi:networks', { 
                            networks, 
                            timestamp: Date.now() 
                        });
                    } catch (error: any) {
                        console.error('❌ WiFi scan error:', error);
                        socket.emit('wifi:error', { 
                            message: error.message,
                            hint: 'Try running server with sudo: sudo npm start'
                        });
                    }
                };
                
                // Immediate scan
                scanAndEmit();
                
                // Then scan at specified interval
                this.wifiScanInterval = setInterval(scanAndEmit, interval);
                
                socket.emit('wifi:scanning-started', { interval: interval / 1000 });
            });

            socket.on('wifi:stop-scanning', () => {
                if (this.wifiScanInterval) {
                    clearInterval(this.wifiScanInterval);
                    this.wifiScanInterval = null;
                }
                socket.emit('wifi:scanning-stopped');
            });

            socket.on('disconnect', () => {
                console.log('Client disconnected:', socket.id);
                // Clean up interval if client disconnects
                if (this.wifiScanInterval) {
                    clearInterval(this.wifiScanInterval);
                    this.wifiScanInterval = null;
                }
                // Clean up conversation history (optional - can keep for persistence)
                // this.conversationHistory.delete(socket.id);
            });
        });
    }

    private setupRoutes() {
        // Serve static files from public directory
        this.app.use(express.static(path.join(__dirname, '../public')));

        this.app.get('/health', (_req: Request, res: Response) => {
            res.json({ status: 'ok' });
        });

        // Weather endpoint
        this.app.get('/weather', async (req: Request, res: Response) => {
            try {
                const lat = parseFloat(req.query.lat as string);
                const lon = parseFloat(req.query.lon as string);
                const city = req.query.city as string;

                const location = !isNaN(lat) && !isNaN(lon) ? { lat, lon, city: city || 'Unknown' } : undefined;
                const weather = await this.weatherTimeService.getWeather(location);
                res.json(weather);
            } catch (error) {
                res.status(500).json({ error: 'Failed to fetch weather data' });
            }
        });

        // Time endpoint
        this.app.get('/time', (req: Request, res: Response) => {
            try {
                const timezone = req.query.timezone as string;
                const lat = parseFloat(req.query.lat as string);
                const lon = parseFloat(req.query.lon as string);

                let timeInfo;
                if (timezone) {
                    timeInfo = this.weatherTimeService.getTime(timezone);
                } else if (!isNaN(lat) && !isNaN(lon)) {
                    timeInfo = this.weatherTimeService.getTimeForLocation({ lat, lon });
                } else {
                    timeInfo = this.weatherTimeService.getTime();
                }

                res.json(timeInfo);
            } catch (error) {
                res.status(500).json({ error: 'Failed to fetch time data' });
            }
        });

        // Combined weather and time endpoint
        this.app.get('/weather-time', async (req: Request, res: Response) => {
            try {
                const lat = parseFloat(req.query.lat as string);
                const lon = parseFloat(req.query.lon as string);
                const city = req.query.city as string;
                const timezone = req.query.timezone as string;

                const location = !isNaN(lat) && !isNaN(lon) ? { lat, lon, city: city || 'Unknown' } : undefined;
                const [weather, time] = await Promise.all([
                    this.weatherTimeService.getWeather(location),
                    this.weatherTimeService.getTime(timezone)
                ]);

                res.json({ weather, time });
            } catch (error) {
                res.status(500).json({ error: 'Failed to fetch weather and time data' });
            }
        });

        // WiFi scanning endpoint (for HTTP polling)
        this.app.get('/api/wifi/scan', async (_req: Request, res: Response) => {
            try {
                if (!this.wifiInitialized || !this.wifiManager) {
                    res.status(503).json({ 
                        error: 'WiFi not initialized. Run with sudo for wdutil access: sudo npm start' 
                    });
                    return;
                }
                const networks = await this.wifiManager.scan();
                res.json({ networks, timestamp: Date.now() });
            } catch (error: any) {
                console.error('WiFi scan error:', error);
                res.status(500).json({ 
                    error: 'Failed to scan WiFi networks',
                    message: error.message,
                    hint: 'Try running server with sudo: sudo npm start'
                });
            }
        });

        // WiFi polling status endpoint
        this.app.get('/api/wifi/status', (_req: Request, res: Response) => {
            res.json({
                initialized: this.wifiInitialized,
                scanning: this.wifiScanInterval !== null,
                timestamp: Date.now()
            });
        });
    }

    private handleInitialize(socket: any) {
        // Create AI user profiles (initialize if not already done)
        this.initializeAIUsers();
        
        const aiUsers: AIUser[] = Array.from(this.aiUsers.values());
        socket.emit('initialized', { users: aiUsers });
    }
    
    private initializeAIUsers() {
        // Only initialize if not already done
        if (this.aiUsers.size === 0) {
            const aiUsers: AIUser[] = [
                {
                    id: 'gemini',
                    type: 'gemini',
                    credits: 1000,
                    friends: ['claude', 'gpt4']
                },
                {
                    id: 'claude',
                    type: 'claude',
                    credits: 1000,
                    friends: ['gemini', 'gpt4']
                },
                {
                    id: 'gpt4',
                    type: 'gpt4',
                    credits: 1000,
                    friends: ['gemini', 'claude']
                }
            ];

            aiUsers.forEach(user => this.aiUsers.set(user.id, user));
        }
    }

    private async handleCommand(socket: any, command: string) {
        try {
            // Parse command (normalize to lowercase for matching)
            const trimmedCommand = command.trim();
            const parts = trimmedCommand.split(' ');
            const action = parts[0].toLowerCase();
            const args = parts.slice(1);

            switch (action) {
                case 'github':
                    await this.handleGitHubCommand(socket, args);
                    break;
                case 'ai':
                    await this.handleAICommand(socket, args);
                    break;
                case 'help':
                    socket.emit('message', {
                        type: 'system',
                        content: 'Available commands:\n  - github clone owner/repo\n  - github search query\n  - ai gemini|claude|gpt4 message\n  - wifi (opens WiFi scanner)\n  - scan (opens WiFi scanner)\n  - ar (opens AR display with ML)\n  - !history (show command history)\n  - help',
                        timestamp: Date.now()
                    });
                    break;
                case '!history':
                    const history = this.historyManager.getLastN(50);
                    if (history.length === 0) {
                        socket.emit('message', {
                            type: 'system',
                            content: 'No command history found.',
                            timestamp: Date.now()
                        });
                    } else {
                        socket.emit('message', {
                            type: 'system',
                            content: `Command History (last ${history.length} commands):\n${history.map((cmd, idx) => `${history.length - idx}. ${cmd}`).join('\n')}`,
                            timestamp: Date.now()
                        });
                    }
                    break;
                case 'wifi':
                case 'scan':
                    socket.emit('message', {
                        type: 'system',
                        content: '🌐 WiFi Scanner: http://localhost:3001/wifi-scanner.html\nClick "Start Scanning" to begin WiFi network visualization.',
                        timestamp: Date.now()
                    });
                    break;
                case 'ar':
                case 'ar-display':
                    socket.emit('message', {
                        type: 'system',
                        content: '🥽 AR Display: http://localhost:3001/ar-mud.html\nEnhanced AR experience with ML object detection, pose tracking, and WiFi visualization.',
                        timestamp: Date.now()
                    });
                    break;
                default:
                    // Echo back with acknowledgment
                    socket.emit('message', {
                        type: 'system',
                        content: `Command "${command}" received. Type "help" for available commands.`,
                        timestamp: Date.now()
                    });
            }
        } catch (error: any) {
            socket.emit('error', { message: error.message || 'Unknown error occurred' });
        }
    }

    private async handleGitHubCommand(socket: any, args: string[]) {
        if (!this.octokit) {
            socket.emit('error', { 
                message: 'GitHub not initialized. Set GITHUB_TOKEN environment variable to enable GitHub commands.' 
            });
            return;
        }

        const [action, ...params] = args;

        switch (action) {
            case 'clone':
                const [repo] = params;
                if (!repo) {
                    socket.emit('error', { message: 'Usage: github clone owner/repo' });
                    return;
                }
                try {
                    const { data: repoData } = await this.octokit.repos.get({
                        owner: repo.split('/')[0],
                        repo: repo.split('/')[1]
                    });
                    socket.emit('github_response', { data: repoData });
                } catch (error: any) {
                    socket.emit('error', { message: `Failed to clone repository: ${error.message}` });
                }
                break;
            case 'search':
                const [query] = params;
                if (!query) {
                    socket.emit('error', { message: 'Usage: github search <query>' });
                    return;
                }
                try {
                    console.log(`🔍 Searching GitHub for: "${query}"`);
                    const { data: searchResults } = await this.octokit.search.repos({
                        q: query
                    });
                    console.log(`✅ Found ${searchResults.items.length} repositories`);
                    socket.emit('github_response', { data: searchResults });
                } catch (error: any) {
                    console.error('❌ GitHub search error:', error);
                    socket.emit('error', { message: `Failed to search repositories: ${error.message}` });
                }
                break;
            default:
                socket.emit('error', { message: 'Unknown GitHub command. Use "clone" or "search".' });
        }
    }

    private async handleAICommand(socket: any, args: string[]) {
        const [aiType, ...message] = args;
        
        console.log(`🤖 Handling AI command:`, {
            aiType,
            messageLength: message.length,
            socketId: socket.id,
            isASCIIRequest: message.some(m => m.includes('ASCII') || m.includes('camera feed'))
        });
        
        // Ensure AI users are initialized
        this.initializeAIUsers();
        
        const aiUser = this.aiUsers.get(aiType);

        if (!aiUser) {
            console.error(`❌ Invalid AI type: ${aiType}`);
            socket.emit('error', { message: `Invalid AI type: ${aiType}. Use 'gemini', 'claude', or 'gpt4'` });
            return;
        }
        
        if (aiUser.credits <= 0) {
            console.error(`❌ Insufficient credits for ${aiType}: ${aiUser.credits}`);
            socket.emit('error', { message: `Insufficient credits for ${aiType}. Current credits: ${aiUser.credits}` });
            return;
        }

        const prompt = message.join(' ');
        let response: string;
        
        console.log(`📝 Processing prompt (${prompt.length} chars):`, {
            preview: prompt.substring(0, 100) + (prompt.length > 100 ? '...' : ''),
            isASCII: prompt.includes('ASCII') || prompt.includes('camera feed')
        });

        switch (aiType) {
            case 'gemini':
                if (!this.gemini) {
                    socket.emit('error', { message: 'Gemini not initialized. Set GEMINI_API_KEY environment variable.' });
                    return;
                }
                // Declare conversation outside try block so it's accessible in catch
                const userId = socket.id;
                let conversation = this.conversationHistory.get(userId) || [];
                
                try {
                    // Add system preface if this is the first message
                    if (conversation.length === 0) {
                        const systemPreface = this.getSystemPreface(aiType);
                        conversation.push({ role: 'user', content: systemPreface });
                        console.log(`📋 Added system preface to new conversation (${systemPreface.length} chars)`);
                    } else {
                        console.log(`📋 Conversation history exists (${conversation.length} messages), skipping preface`);
                    }
                    
                    // Keep last 20 messages (10 exchanges) to maintain context
                    if (conversation.length > 20) {
                        conversation = conversation.slice(-20);
                    }
                    
                    // Add current user message
                    conversation.push({ role: 'user', content: prompt });
                    
                    // Use gemini-2.0-flash-exp with conversation history
                    const geminiModel = this.gemini.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });
                    
                    // Build messages array with history for Gemini
                    // Gemini API expects contents array with role and parts at the top level
                    // Each content object should have: { role: 'user'|'model', parts: [{ text: string }] }
                    const contents = conversation.map(msg => ({
                        role: msg.role === 'user' ? 'user' : 'model',
                        parts: [{ text: msg.content }]
                    }));
                    
                    // Use generateContent with proper format - pass as contents array
                    const geminiResult = await geminiModel.generateContent({
                        contents: contents
                    });
                    const responseText = geminiResult.response.text();
                    if (!responseText) {
                        throw new Error('No response from Gemini');
                    }
                    response = responseText;
                    
                    // Add assistant response to history
                    conversation.push({ role: 'model', content: response });
                    this.conversationHistory.set(userId, conversation);
                    
                    console.log(`💬 Gemini response received:`, {
                        userId,
                        conversationLength: conversation.length,
                        responseLength: response.length,
                        hasPreface: conversation.some(msg => msg.content.includes('GitHub search')),
                        hasASCII: conversation.some(msg => msg.content.includes('ASCII') || msg.content.includes('```')),
                        preview: response.substring(0, 100) + (response.length > 100 ? '...' : '')
                    });
                } catch (error: any) {
                    console.error('❌ Gemini API error:', {
                        message: error.message,
                        status: error.status,
                        statusText: error.statusText,
                        stack: error.stack,
                        userId: socket.id,
                        conversationLength: conversation?.length || 0
                    });
                    
                    // Handle rate limit / quota errors specifically
                    let errorMessage = error.message || 'Unknown error';
                    
                    if (error.status === 429 || error.message?.includes('quota') || error.message?.includes('rate limit')) {
                        errorMessage = `Gemini API quota exceeded. You've hit the free tier limit (50 requests/day). ` +
                            `Please wait or upgrade your plan. See: https://ai.google.dev/gemini-api/docs/rate-limits`;
                        
                        // Check if there's a retry delay in the error
                        if (error.message?.includes('Please retry in')) {
                            const retryMatch = error.message.match(/Please retry in ([\d.]+)s/);
                            if (retryMatch) {
                                const retrySeconds = parseFloat(retryMatch[1]);
                                errorMessage += `\n\nYou can retry in approximately ${Math.ceil(retrySeconds)} seconds.`;
                            }
                        }
                    } else if (error.status === 401) {
                        errorMessage = `Gemini API authentication failed. Please check your GEMINI_API_KEY.`;
                    } else if (error.status === 404) {
                        errorMessage = `Gemini model not found. The model 'gemini-2.0-flash-exp' may have been deprecated or renamed.`;
                    }
                    
                    socket.emit('error', { message: errorMessage });
                    return;
                }
                break;
            case 'claude':
                if (!this.anthropic) {
                    socket.emit('error', { message: 'Claude not initialized. Set ANTHROPIC_API_KEY environment variable.' });
                    return;
                }
                // Get conversation history for Claude
                const userIdClaude = socket.id;
                let conversationClaude = this.conversationHistory.get(userIdClaude) || [];
                
                // Add system preface if this is the first message
                if (conversationClaude.length === 0) {
                    const systemPreface = this.getSystemPreface(aiType);
                    conversationClaude.push({ role: 'user', content: systemPreface });
                }
                
                // Add current message
                conversationClaude.push({ role: 'user', content: prompt });
                
                // Keep last 20 messages
                if (conversationClaude.length > 20) {
                    conversationClaude = conversationClaude.slice(-20);
                }
                
                const claudeMessages = conversationClaude.map(msg => ({
                    role: msg.role === 'user' ? 'user' : 'assistant',
                    content: msg.content
                }));
                
                const claudeResponse = await this.anthropic.messages.create({
                    model: 'claude-3-opus-20240229',
                    max_tokens: 1000,
                    messages: claudeMessages as any
                });
                const claudeText = claudeResponse.content[0];
                if ('text' in claudeText) {
                    response = claudeText.text;
                    
                    // Add assistant response to history
                    conversationClaude.push({ role: 'model', content: response });
                    this.conversationHistory.set(userIdClaude, conversationClaude);
                } else {
                    response = 'Claude returned non-text content';
                }
                break;
            case 'gpt4':
                if (!this.openai) {
                    socket.emit('error', { message: 'OpenAI not initialized. Set OPENAI_API_KEY environment variable.' });
                    return;
                }
                // Get conversation history for GPT-4
                const userIdGPT = socket.id;
                let conversationGPT = this.conversationHistory.get(userIdGPT) || [];
                
                // Add system preface if this is the first message
                if (conversationGPT.length === 0) {
                    const systemPreface = this.getSystemPreface(aiType);
                    conversationGPT.push({ role: 'user', content: systemPreface });
                }
                
                // Add current message
                conversationGPT.push({ role: 'user', content: prompt });
                
                // Keep last 20 messages
                if (conversationGPT.length > 20) {
                    conversationGPT = conversationGPT.slice(-20);
                }
                
                const gptMessages = conversationGPT.map(msg => ({
                    role: msg.role === 'user' ? 'user' : 'assistant',
                    content: msg.content
                }));
                
                const gptResponse = await this.openai.chat.completions.create({
                    model: 'gpt-4',
                    messages: gptMessages as any
                });
                const gptContent = gptResponse.choices[0]?.message?.content;
                if (!gptContent) {
                    throw new Error('No response from OpenAI');
                }
                response = gptContent;
                
                // Add assistant response to history
                conversationGPT.push({ role: 'model', content: response });
                this.conversationHistory.set(userIdGPT, conversationGPT);
                break;
            default:
                socket.emit('error', { message: 'Invalid AI type' });
                return;
        }

        // Deduct credits
        aiUser.credits -= 1;
        this.aiUsers.set(aiType, aiUser);

        // Check if AI response contains GitHub search commands
        const githubSearchMatch = this.parseGitHubSearchCommand(response);
        if (githubSearchMatch) {
            console.log(`🤖 AI requested GitHub search: "${githubSearchMatch.query}"`);
            
            // Generate unique search ID
            const searchId = `${socket.id}-${Date.now()}`;
            
            // Store pending search (will cost 1 credit for follow-up response)
            this.pendingGitHubSearches.set(searchId, {
                aiType,
                query: githubSearchMatch.query,
                userId: socket.id,
                originalResponse: response,
                credits: aiUser.credits
            });
            
            // Emit original response with confirmation prompt
            socket.emit('ai_response', {
                type: aiType,
                response,
                credits: aiUser.credits,
                hasGitHubSearch: true,
                githubQuery: githubSearchMatch.query,
                searchId: searchId,
                requiresConfirmation: true
            });
            
            // Emit confirmation prompt
            socket.emit('github_search_confirmation', {
                searchId: searchId,
                query: githubSearchMatch.query,
                aiType: aiType,
                message: `AI wants to search GitHub for "${githubSearchMatch.query}". This will cost 1 additional credit. Proceed? [Y/n]`,
                credits: aiUser.credits
            });
            return;
        }

        // Check if this is a camera-based request (ASCII image)
        const isCameraRequest = prompt.includes('ASCII') || prompt.includes('camera feed') || prompt.includes('ASCII representation');
        
        console.log('📤 Emitting ai_response to socket:', {
            socketId: socket.id,
            aiType,
            responseLength: response.length,
            hasPrompt: !!prompt,
            isCameraRequest,
            credits: aiUser.credits
        });
        
        socket.emit('ai_response', {
            type: aiType,
            response,
            credits: aiUser.credits,
            prompt: prompt, // Include the original prompt for display
            isCameraRequest: isCameraRequest // Flag to help client-side detection
        });
        
        console.log('✅ ai_response event emitted');
    }
    
    // Parse GitHub search command from AI response
    private parseGitHubSearchCommand(response: string): { query: string } | null {
        // Look for patterns like:
        // - "github search <query>"
        // - "github search: <query>"
        // - "search github for <query>"
        // - "find <query> on github"
        // Priority: quoted strings first, then unquoted text
        
        // Pattern 1: github search "query" (quoted)
        let match = response.match(/github\s+search[:\s]+["']([^"']+)["']/i);
        if (match && match[1]) {
            const query = match[1].trim();
            if (query.length > 0 && query.length < 200) return { query };
        }
        
        // Pattern 2: github search `query` (backticks)
        match = response.match(/github\s+search[:\s]+`([^`]+)`/i);
        if (match && match[1]) {
            const query = match[1].trim();
            if (query.length > 0 && query.length < 200) return { query };
        }
        
        // Pattern 3: search github for "query" (quoted)
        match = response.match(/search\s+github\s+for[:\s]+["']([^"']+)["']/i);
        if (match && match[1]) {
            const query = match[1].trim();
            if (query.length > 0 && query.length < 200) return { query };
        }
        
        // Pattern 4: find "query" on github (quoted)
        match = response.match(/find[:\s]+["']([^"']+)["']\s+on\s+github/i);
        if (match && match[1]) {
            const query = match[1].trim();
            if (query.length > 0 && query.length < 200) return { query };
        }
        
        // Pattern 5: search for "query" on github (quoted)
        match = response.match(/search\s+for[:\s]+["']([^"']+)["']\s+on\s+github/i);
        if (match && match[1]) {
            const query = match[1].trim();
            if (query.length > 0 && query.length < 200) return { query };
        }
        
        // Unquoted patterns - be more careful with word boundaries
        // Pattern 6: github search <text> (until newline, period, or end)
        match = response.match(/github\s+search[:\s]+([^\n\.]+?)(?:\.|\n|$)/i);
        if (match && match[1]) {
            let query = match[1].trim();
            // Remove common trailing words
            query = query.replace(/\s+(on\s+github|in\s+github|github|\.)$/i, '').trim();
            // Remove trailing punctuation
            query = query.replace(/[.,;:!?]+$/, '').trim();
            if (query.length > 0 && query.length < 200 && !query.match(/^(for|the|a|an)$/i)) {
                return { query };
            }
        }
        
        // Pattern 7: search github for <text> (until newline, period, or end)
        match = response.match(/search\s+github\s+for[:\s]+([^\n\.]+?)(?:\.|\n|$)/i);
        if (match && match[1]) {
            let query = match[1].trim();
            // Remove common trailing words
            query = query.replace(/\s+(on\s+github|in\s+github|github|\.)$/i, '').trim();
            // Remove trailing punctuation
            query = query.replace(/[.,;:!?]+$/, '').trim();
            if (query.length > 0 && query.length < 200 && !query.match(/^(for|the|a|an)$/i)) {
                return { query };
            }
        }
        
        return null;
    }
    
    // Execute GitHub search
    private async executeGitHubSearch(query: string): Promise<any> {
        if (!this.octokit) {
            console.warn('⚠️ GitHub not initialized, cannot execute search');
            return null;
        }
        
        try {
            console.log(`🔍 Executing GitHub search for: "${query}"`);
            const { data: searchResults } = await this.octokit.search.repos({
                q: query
            });
            console.log(`✅ Found ${searchResults.items.length} repositories`);
            return searchResults;
        } catch (error: any) {
            console.error('❌ GitHub search error:', error);
            return null;
        }
    }
    
    // Format GitHub search results for AI consumption
    private formatGitHubSearchResults(searchResults: any): string {
        if (!searchResults || !searchResults.items || searchResults.items.length === 0) {
            return 'No repositories found.';
        }
        
        const items = searchResults.items.slice(0, 10); // Limit to top 10
        const formatted = items.map((repo: any, index: number) => {
            return `${index + 1}. ${repo.full_name} (⭐ ${repo.stargazers_count})
   Description: ${repo.description || 'No description'}
   Language: ${repo.language || 'N/A'}
   URL: ${repo.html_url}
   Updated: ${new Date(repo.updated_at).toLocaleDateString()}`;
        }).join('\n\n');
        
        return `Found ${searchResults.total_count} repositories (showing top ${items.length}):\n\n${formatted}`;
    }
    
    // Send follow-up message to AI with GitHub results
    private async sendFollowUpToAI(aiType: string, userId: string, followUpMessage: string): Promise<string | null> {
        try {
            // Get conversation history
            let conversation = this.conversationHistory.get(userId) || [];
            
            // Add GitHub results as a system/user message
            conversation.push({ role: 'user', content: followUpMessage });
            
            // Keep last 20 messages
            if (conversation.length > 20) {
                conversation = conversation.slice(-20);
            }
            
            switch (aiType) {
                case 'gemini':
                    if (!this.gemini) return null;
                    const geminiModel = this.gemini.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });
                    const contents = conversation.map(msg => ({
                        role: msg.role === 'user' ? 'user' : 'model',
                        parts: [{ text: msg.content }]
                    }));
                    const geminiResult = await geminiModel.generateContent({ contents });
                    const geminiResponse = geminiResult.response.text();
                    
                    if (geminiResponse) {
                        conversation.push({ role: 'model', content: geminiResponse });
                        this.conversationHistory.set(userId, conversation);
                        return geminiResponse;
                    }
                    break;
                    
                case 'claude':
                    if (!this.anthropic) return null;
                    // Get conversation history for Claude
                    const claudeMessages = conversation.map(msg => ({
                        role: msg.role === 'user' ? 'user' : 'assistant',
                        content: msg.content
                    }));
                    const claudeResponse = await this.anthropic.messages.create({
                        model: 'claude-3-opus-20240229',
                        max_tokens: 1000,
                        messages: claudeMessages as any
                    });
                    const claudeText = claudeResponse.content[0];
                    if ('text' in claudeText) {
                        const claudeResponseText = claudeText.text;
                        conversation.push({ role: 'model', content: claudeResponseText });
                        this.conversationHistory.set(userId, conversation);
                        return claudeResponseText;
                    }
                    break;
                    
                case 'gpt4':
                    if (!this.openai) return null;
                    const gptMessages = conversation.map(msg => ({
                        role: msg.role === 'user' ? 'user' : 'assistant',
                        content: msg.content
                    }));
                    const gptResponse = await this.openai.chat.completions.create({
                        model: 'gpt-4',
                        messages: gptMessages as any
                    });
                    const gptContent = gptResponse.choices[0]?.message?.content;
                    if (gptContent) {
                        conversation.push({ role: 'model', content: gptContent });
                        this.conversationHistory.set(userId, conversation);
                        return gptContent;
                    }
                    break;
            }
        } catch (error: any) {
            console.error(`Error sending follow-up to ${aiType}:`, error);
        }
        
        return null;
    }
    
    // Get system preface for AI models
    private getSystemPreface(_aiType: string): string {
        return `Hello! This is a preface for an AI MUD system. You are included as a voice to discuss events and topics, which may include code discussions.

To empower you, we have included an automatic GitHub search feature. To request a GitHub search, use the command exactly as follows:

github search "query string here"

Important rules:
- Always use the exact format: github search "your query here"
- Use quotes around the search query
- Do not use sentences or lists - use the command format directly
- Examples:
  * Correct: github search "python web scraping"
  * Correct: github search "typescript react hooks"
  * Incorrect: "I'll search github for python web scraping"
  * Incorrect: "Let me search for python web scraping on github"
  * Incorrect: "github search python web scraping" (missing quotes)

When you want to search GitHub, simply output the command in the format above. The system will automatically execute the search and provide you with results to analyze.`;
    }
    
    // Handle GitHub search confirmation from user
    private async handleGitHubSearchConfirmation(socket: any, searchId: string, confirmed: boolean) {
        const pendingSearch = this.pendingGitHubSearches.get(searchId);
        
        if (!pendingSearch) {
            socket.emit('error', { message: 'Search request not found or expired' });
            return;
        }
        
        // Remove from pending searches
        this.pendingGitHubSearches.delete(searchId);
        
        // Default to 'yes' if not explicitly declined
        if (!confirmed && confirmed !== false) {
            // If user didn't explicitly say no, treat as yes (default)
            confirmed = true;
        }
        
        if (!confirmed) {
            socket.emit('message', {
                type: 'system',
                content: 'GitHub search cancelled by user.',
                timestamp: Date.now()
            });
            return;
        }
        
        // User confirmed - execute the search
        const { aiType, query, userId } = pendingSearch;
        
        try {
            // Execute GitHub search
            const searchResults = await this.executeGitHubSearch(query);
            
            if (searchResults) {
                // Format results for AI
                const formattedResults = this.formatGitHubSearchResults(searchResults);
                
                // Send results back to AI as a follow-up message
                const followUpResponse = await this.sendFollowUpToAI(
                    aiType,
                    userId,
                    `GitHub search results for "${query}":\n\n${formattedResults}`
                );
                
                if (followUpResponse) {
                    // Get current AI user state
                    const aiUser = this.aiUsers.get(aiType);
                    if (aiUser) {
                        // Deduct credit for follow-up response
                        aiUser.credits -= 1;
                        this.aiUsers.set(aiType, aiUser);
                        
                        // Emit search results to chat first
                        socket.emit('github_response', { 
                            data: searchResults,
                            query: query,
                            source: 'ai-requested'
                        });
                        
                        // Then emit AI's analysis of the results
                        socket.emit('ai_response', {
                            type: aiType,
                            response: followUpResponse,
                            credits: aiUser.credits,
                            isFollowUp: true,
                            githubQuery: query,
                            searchId: searchId,
                            prompt: `GitHub search results for "${query}"`
                        });
                    }
                } else {
                    // Still emit search results even if AI response fails
                    socket.emit('github_response', { 
                        data: searchResults,
                        query: query,
                        source: 'ai-requested'
                    });
                    socket.emit('error', { message: 'Failed to get AI response to search results' });
                }
            } else {
                socket.emit('error', { message: 'GitHub search failed or returned no results' });
            }
        } catch (error: any) {
            console.error('Error executing confirmed GitHub search:', error);
            socket.emit('error', { message: `GitHub search error: ${error.message}` });
        }
    }

    public start(port: number = 3001) {
        this.server.listen(port, () => {
            console.log(`MUD server running on port ${port}`);
        });
    }
}

// Start the server
const mudServer = new MUDServer();
mudServer.start(); 