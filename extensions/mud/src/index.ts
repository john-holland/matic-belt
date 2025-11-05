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
import { TokenTracker } from './token-tracker';
import { loadApiKeysFromFile, getApiKey } from './api-key-loader';
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
    private localOllama: OpenAI | null = null;
    private ollamaHost: string;
    private ollamaModel: string;
    private aiUsers: Map<string, AIUser> = new Map();
    private speechTracker: SpeechTracker;
    private weatherTimeService: WeatherTimeService;
    private audioChat: AudioChat;
    private historyManager: HistoryManager;
    private tokenTracker: TokenTracker;
    // Conversation history per user (socket.id or userId) - keeps last 20 messages for context
    // Use socket.id as key, but we can also use userId if provided for cross-socket history
    private conversationHistory: Map<string, Array<{ role: string; content: string }>> = new Map();
    // Map socket IDs to user IDs for shared conversation history
    private socketToUser: Map<string, string> = new Map();
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
        // Initialize Ollama configuration
        this.ollamaHost = process.env.OLLAMA_HOST || 'http://localhost:11434';
        this.ollamaModel = process.env.OLLAMA_MODEL || 'qwen2.5-coder:7b';
        
        this.initializeGitHub();
        this.initializeAI();
        this.initializeWiFi();
        this.initializeAIUsers(); // Initialize AI users at startup
        this.speechTracker = new SpeechTracker();
        this.weatherTimeService = new WeatherTimeService();
        this.audioChat = new AudioChat();
        this.historyManager = new HistoryManager();
        this.tokenTracker = new TokenTracker();
        this.initializeTokenLimits();
        this.setupSocketHandlers();
        this.setupRoutes();
    }

    private initializeTokenLimits() {
        // Load token limits from JSON file (or initialize defaults if not present)
        const geminiStatus = this.tokenTracker.getStatus('gemini');
        
        if (!geminiStatus) {
            // If not in JSON file, initialize with defaults: 50 tokens per day
            this.tokenTracker.initializeService('gemini', 50, 86400000, 0); // 86400000ms = 24 hours
            console.log(`📊 Token limits initialized (defaults):`);
            console.log(`   Gemini: 0/50 tokens used (fresh start)`);
        } else {
            // Log status from loaded JSON file
            const hoursUntilReset = Math.ceil(geminiStatus.timeUntilReset / (1000 * 60 * 60));
            const minutesUntilReset = Math.ceil(geminiStatus.timeUntilReset / (1000 * 60));
            const timeMessage = hoursUntilReset >= 1 
                ? `${hoursUntilReset} hour(s)` 
                : `${minutesUntilReset} minute(s)`;
            
            console.log(`📊 Token limits loaded from file:`);
            console.log(`   Gemini: ${geminiStatus.used}/${geminiStatus.maxTokens} tokens used`);
            if (geminiStatus.timeUntilReset > 0) {
                console.log(`   Reset in: ~${timeMessage}`);
            } else {
                console.log(`   ✅ Limit reset - tokens available!`);
            }
        }
        
        // Log OpenAI status if available
        const openaiStatus = this.tokenTracker.getStatus('openai');
        if (openaiStatus) {
            const hoursUntilReset = Math.ceil(openaiStatus.timeUntilReset / (1000 * 60 * 60));
            const minutesUntilReset = Math.ceil(openaiStatus.timeUntilReset / (1000 * 60));
            const timeMessage = hoursUntilReset >= 1 
                ? `${hoursUntilReset} hour(s)` 
                : `${minutesUntilReset} minute(s)`;
            
            console.log(`   OpenAI: ${openaiStatus.used}/${openaiStatus.maxTokens} tokens used`);
            if (openaiStatus.timeUntilReset > 0) {
                console.log(`   Reset in: ~${timeMessage}`);
            } else {
                console.log(`   ✅ Limit reset - tokens available!`);
            }
        }
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

    private apiKeys: ReturnType<typeof loadApiKeysFromFile> = {};

    private async initializeGitHub() {
        try {
            // Load API keys from file (fallback to env vars)
            this.apiKeys = loadApiKeysFromFile();
            
            const githubToken = getApiKey('GITHUB_TOKEN', this.apiKeys.githubToken);
            if (githubToken) {
                this.octokit = new Octokit({
                    auth: githubToken
                });
                console.log('✅ GitHub initialized');
            }
        } catch (error) {
            console.warn('⚠️ GitHub not initialized (optional):', error);
        }
    }

    private async initializeAI() {
        try {
            // Load API keys from file (fallback to env vars)
            if (Object.keys(this.apiKeys).length === 0) {
                this.apiKeys = loadApiKeysFromFile();
            }
            
            // Initialize Gemini (optional)
            const geminiKey = getApiKey('GEMINI_API_KEY', this.apiKeys.geminiApiKey);
            if (geminiKey) {
                this.gemini = new GoogleGenerativeAI(geminiKey);
                console.log('✅ Gemini initialized');
            }
        } catch (error) {
            console.warn('⚠️ Gemini not initialized (optional):', error);
        }

        try {
            // Initialize OpenAI (optional)
            const openaiKey = getApiKey('OPENAI_API_KEY', this.apiKeys.openaiApiKey);
            if (openaiKey) {
                this.openai = new OpenAI({
                    apiKey: openaiKey
                });
                console.log('✅ OpenAI initialized');
            }
        } catch (error) {
            console.warn('⚠️ OpenAI not initialized (optional):', error);
        }

        try {
            // Initialize Anthropic (optional)
            const anthropicKey = getApiKey('ANTHROPIC_API_KEY', this.apiKeys.anthropicApiKey);
            if (anthropicKey) {
                this.anthropic = new Anthropic({
                    apiKey: anthropicKey
                });
                console.log('✅ Anthropic initialized');
            }
        } catch (error) {
            console.warn('⚠️ Anthropic not initialized (optional):', error);
        }

        try {
            // Initialize Ollama (local AI) - always try to initialize
            // Check if Ollama is available
            const testResponse = await fetch(`${this.ollamaHost}/api/tags`, { 
                method: 'GET',
                signal: AbortSignal.timeout(2000) // 2 second timeout
            });
            
            if (testResponse.ok) {
                this.localOllama = new OpenAI({
                    apiKey: 'ollama', // Ollama doesn't require auth, but OpenAI SDK needs a value
                    baseURL: `${this.ollamaHost}/v1`
                });
                console.log(`✅ Ollama (local AI) initialized: ${this.ollamaModel} at ${this.ollamaHost}`);
            } else {
                console.log(`ℹ️ Ollama not available at ${this.ollamaHost} (optional - will use other AIs if available)`);
            }
        } catch (error) {
            console.log(`ℹ️ Ollama not available at ${this.ollamaHost} (optional - will use other AIs if available)`);
            // Don't warn - Ollama is optional
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
            
            // Generate or retrieve a user ID for this socket
            // This allows sharing conversation history across multiple sockets from the same user
            // For now, we'll use socket.id, but we can enhance this with actual user authentication later
            const userId = socket.handshake.query.userId as string || socket.id;
            this.socketToUser.set(socket.id, userId);

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
                    friends: ['claude', 'gpt4', 'local']
                },
                {
                    id: 'claude',
                    type: 'claude',
                    credits: 1000,
                    friends: ['gemini', 'gpt4', 'local']
                },
                {
                    id: 'gpt4',
                    type: 'gpt4',
                    credits: 1000,
                    friends: ['gemini', 'claude', 'local']
                },
                {
                    id: 'local',
                    type: 'local',
                    credits: 10000, // Higher credits since it's free local
                    friends: ['gemini', 'claude', 'gpt4']
                }
            ];

            aiUsers.forEach(user => this.aiUsers.set(user.id, user));
        }
    }

    private async handleCommand(socket: any, command: string) {
        try {
            // Parse command (normalize to lowercase for matching)
            const trimmedCommand = command.trim();
            const parts = trimmedCommand.split(/\s+/);
            const action = parts[0].toLowerCase();
            const args = parts.slice(1);

            switch (action) {
                case 'github':
                    await this.handleGitHubCommand(socket, args);
                    break;
                case 'ai':
                    // Validate that "ai" command is at the start of the line (not in the middle of text)
                    // This prevents false matches from text like "the ai local response was good"
                    if (!trimmedCommand.match(/^ai\s/i)) {
                        socket.emit('error', { message: 'AI commands must start with "ai". Example: ai local "your message"' });
                        return;
                    }
                    
                    // Check for AI-to-AI communication: "ai talk:gemini "message""
                    const commandStr = trimmedCommand.toLowerCase();
                    const talkMatch = commandStr.match(/^ai\s+talk:(\w+)\s+["']([^"']+)["']/i);
                    if (talkMatch) {
                        const targetAI = talkMatch[1].toLowerCase();
                        const message = talkMatch[2];
                        await this.handleAIToAITalk(socket, targetAI, message, trimmedCommand);
                    } else {
                        // Validate that this is a proper AI command (not just text containing "ai")
                        // Require: "ai <type> <message>" where message is either quoted or starts after proper spacing
                        if (args.length === 0) {
                            socket.emit('error', { message: 'Usage: ai <gemini|claude|gpt4|local> "your message" or ai <type> your message' });
                            return;
                        }
                        await this.handleAICommand(socket, args);
                    }
                    break;
                case 'help':
                    socket.emit('message', {
                        type: 'system',
                        content: 'Available commands:\n  - github clone owner/repo\n  - github search query\n  - ai gemini|claude|gpt4|local message\n  - wifi (opens WiFi scanner)\n  - scan (opens WiFi scanner)\n  - ar (opens AR display with ML)\n  - !history (show command history)\n  - help',
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
        const [aiType, ...messageParts] = args;
        
        // Validate AI type
        if (!aiType || !['gemini', 'claude', 'gpt4', 'local'].includes(aiType.toLowerCase())) {
            socket.emit('error', { message: `Invalid AI type: ${aiType}. Use 'gemini', 'claude', 'gpt4', or 'local'` });
            return;
        }
        
        // Join message parts and check for quotes or newlines
        let messageText = messageParts.join(' ').trim();
        
        // If message starts and ends with matching quotes, extract the quoted content
        const quotedMatch = messageText.match(/^(["'])(.+?)\1$/);
        if (quotedMatch) {
            messageText = quotedMatch[2];
        } else if (messageText.match(/^["']/)) {
            // Starts with quote but doesn't end with matching quote - might be unclosed
            // Try to extract up to the next quote or end of string
            const singleQuoteMatch = messageText.match(/^["'](.+?)(?:["']|$)/);
            if (singleQuoteMatch) {
                messageText = singleQuoteMatch[1];
            }
        } else {
            // Unquoted message - check if it looks like a proper command
            // Require at least some content after the AI type
            if (messageText.length === 0) {
                socket.emit('error', { message: 'Please provide a message for the AI. Example: ai local "your message here" or ai local your message' });
                return;
            }
            
            // Warn if message is very short (might be accidental)
            if (messageText.length < 3) {
                console.warn(`⚠️ Very short AI message: "${messageText}" - might be accidental`);
            }
        }
        
        const message = [messageText];
        
        console.log(`🤖 Handling AI command:`, {
            aiType,
            messageLength: message.length,
            messageText: messageText.substring(0, 50) + (messageText.length > 50 ? '...' : ''),
            socketId: socket.id,
            isASCIIRequest: messageText.includes('ASCII') || messageText.includes('camera feed')
        });
        
        // Ensure AI users are initialized
        this.initializeAIUsers();
        
        const aiUser = this.aiUsers.get(aiType);

        if (!aiUser) {
            console.error(`❌ Invalid AI type: ${aiType}`);
            socket.emit('error', { message: `Invalid AI type: ${aiType}. Use 'gemini', 'claude', 'gpt4', or 'local'` });
            return;
        }
        
        if (aiUser.credits <= 0) {
            console.error(`❌ Insufficient credits for ${aiType}: ${aiUser.credits}`);
            socket.emit('error', { message: `Insufficient credits for ${aiType}. Current credits: ${aiUser.credits}` });
            return;
        }

        const prompt = message.join(' ');
        let response: string;
        
        // Get user ID for conversation history (shared across all AI types)
        const userKey = this.socketToUser.get(socket.id) || socket.id;
        
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
                
                // Check token limits before making API call
                if (!this.tokenTracker.hasTokens('gemini')) {
                    const status = this.tokenTracker.getStatus('gemini');
                    if (status) {
                        const hoursUntilReset = Math.ceil(status.timeUntilReset / (1000 * 60 * 60));
                        const minutesUntilReset = Math.ceil(status.timeUntilReset / (1000 * 60));
                        const timeMessage = hoursUntilReset >= 1 
                            ? `${hoursUntilReset} hour(s)` 
                            : `${minutesUntilReset} minute(s)`;
                        
                        socket.emit('error', { 
                            message: `Gemini API token limit reached (${status.used}/${status.maxTokens} used). ` +
                                `Limit resets in approximately ${timeMessage}. ` +
                                `Free tier allows 50 requests per day.`
                        });
                        return;
                    }
                }
                
                // Declare conversation outside try block so it's accessible in catch
                let conversation = this.conversationHistory.get(userKey) || [];
                
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
                    
                    // Spend a token after successful API call
                    this.tokenTracker.spendTokens('gemini', 1);
                    
                    // Add assistant response to history
                    conversation.push({ role: 'model', content: response });
                    this.conversationHistory.set(userKey, conversation);
                    
                    console.log(`💬 Gemini response received:`, {
                        userId: userKey,
                        socketId: socket.id,
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
                let conversationClaude = this.conversationHistory.get(userKey) || [];
                
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
                    this.conversationHistory.set(userKey, conversationClaude);
                } else {
                    response = 'Claude returned non-text content';
                }
                break;
            case 'gpt4':
                if (!this.openai) {
                    socket.emit('error', { message: 'OpenAI not initialized. Set OPENAI_API_KEY environment variable.' });
                    return;
                }
                
                // Check token limits before making API call
                if (!this.tokenTracker.hasTokens('openai')) {
                    const status = this.tokenTracker.getStatus('openai');
                    if (status) {
                        const hoursUntilReset = Math.ceil(status.timeUntilReset / (1000 * 60 * 60));
                        const minutesUntilReset = Math.ceil(status.timeUntilReset / (1000 * 60));
                        const timeMessage = hoursUntilReset >= 1 
                            ? `${hoursUntilReset} hour(s)` 
                            : `${minutesUntilReset} minute(s)`;
                        
                        socket.emit('error', { 
                            message: `OpenAI API token limit reached (${status.used}/${status.maxTokens} used). ` +
                                `Limit resets in approximately ${timeMessage}.`
                        });
                        return;
                    }
                }
                
                // Get conversation history for GPT-4
                let conversationGPT = this.conversationHistory.get(userKey) || [];
                
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
                
                // Try gpt-4o first (latest), fallback to gpt-4-turbo, then gpt-3.5-turbo
                let model = 'gpt-4o';
                try {
                    const gptResponse = await this.openai.chat.completions.create({
                        model: model,
                        messages: gptMessages as any
                    });
                    const gptContent = gptResponse.choices[0]?.message?.content;
                    if (!gptContent) {
                        throw new Error('No response from OpenAI');
                    }
                    response = gptContent;
                } catch (error: any) {
                    // Handle quota/rate limit errors from OpenAI
                    if (error.status === 429 || error.message?.includes('quota') || error.message?.includes('rate limit')) {
                        console.error('❌ OpenAI API quota/rate limit error:', {
                            status: error.status,
                            message: error.message,
                            statusText: error.statusText
                        });
                        
                        let errorMessage = `OpenAI API quota exceeded. `;
                        if (error.message?.includes('billing')) {
                            errorMessage += `Please check your OpenAI billing and plan details. `;
                        }
                        errorMessage += `See: https://platform.openai.com/docs/guides/error-codes/api-errors`;
                        
                        socket.emit('error', { message: errorMessage });
                        return;
                    }
                    
                    // Try fallback models if gpt-4o fails
                    if (error.message?.includes('does not exist') || error.status === 404) {
                        console.log(`⚠️ Model ${model} not available, trying gpt-4-turbo...`);
                        try {
                            model = 'gpt-4-turbo';
                            const gptResponse = await this.openai.chat.completions.create({
                                model: model,
                                messages: gptMessages as any
                            });
                            const gptContent = gptResponse.choices[0]?.message?.content;
                            if (!gptContent) {
                                throw new Error('No response from OpenAI');
                            }
                            response = gptContent;
                        } catch (error2: any) {
                            // Check for quota errors in fallback too
                            if (error2.status === 429 || error2.message?.includes('quota')) {
                                socket.emit('error', { 
                                    message: `OpenAI API quota exceeded. Please check your billing and plan.` 
                                });
                                return;
                            }
                            
                            console.log(`⚠️ Model ${model} not available, trying gpt-3.5-turbo...`);
                            model = 'gpt-3.5-turbo';
                            const gptResponse = await this.openai.chat.completions.create({
                                model: model,
                                messages: gptMessages as any
                            });
                            const gptContent = gptResponse.choices[0]?.message?.content;
                            if (!gptContent) {
                                throw new Error('No response from OpenAI');
                            }
                            response = gptContent;
                        }
                    } else {
                        // Re-throw other errors
                        throw error;
                    }
                }
                
                // Spend a token after successful API call
                this.tokenTracker.spendTokens('openai', 1);
                
                // Add assistant response to history
                conversationGPT.push({ role: 'model', content: response });
                this.conversationHistory.set(userKey, conversationGPT);
                break;
            case 'local':
                if (!this.localOllama) {
                    socket.emit('error', { 
                        message: `Local AI (Ollama) not available. Make sure Ollama is running at ${this.ollamaHost}. Install from: https://ollama.ai` 
                    });
                    return;
                }
                
                // Local AI doesn't need token limits (it's free!)
                // But we can still track usage for monitoring
                
                // Get conversation history for local AI (uses shared userKey)
                let conversationLocal = this.conversationHistory.get(userKey) || [];
                
                try {
                    // Add system preface if this is the first message
                    if (conversationLocal.length === 0) {
                        const systemPreface = this.getSystemPreface(aiType);
                        conversationLocal.push({ role: 'user', content: systemPreface });
                        console.log(`📋 Added system preface to new conversation (${systemPreface.length} chars)`);
                    } else {
                        console.log(`📋 Conversation history exists (${conversationLocal.length} messages), skipping preface`);
                    }
                    
                    // Keep last 20 messages (10 exchanges) to maintain context
                    if (conversationLocal.length > 20) {
                        conversationLocal = conversationLocal.slice(-20);
                    }
                    
                    // Add current user message
                    conversationLocal.push({ role: 'user', content: prompt });
                    
                    // Use OpenAI-compatible API format with Ollama
                    const ollamaMessages = conversationLocal.map(msg => ({
                        role: msg.role === 'user' ? 'user' : 'assistant',
                        content: msg.content
                    }));
                    
                    const ollamaResponse = await this.localOllama.chat.completions.create({
                        model: this.ollamaModel,
                        messages: ollamaMessages as any,
                        temperature: 0.7,
                        max_tokens: 2000
                    });
                    
                    const ollamaContent = ollamaResponse.choices[0]?.message?.content;
                    if (!ollamaContent) {
                        throw new Error('No response from Ollama');
                    }
                    response = ollamaContent;
                    
                    // Add assistant response to history
                    conversationLocal.push({ role: 'assistant', content: response });
                    this.conversationHistory.set(userKey, conversationLocal);
                    
                    console.log(`💬 Local AI (Ollama) response received:`, {
                        userId: userKey,
                        socketId: socket.id,
                        conversationLength: conversationLocal.length,
                        responseLength: response.length,
                        model: this.ollamaModel,
                        preview: response.substring(0, 100) + (response.length > 100 ? '...' : '')
                    });
                } catch (error: any) {
                    console.error('❌ Ollama API error:', {
                        message: error.message,
                        status: error.status,
                        statusText: error.statusText,
                        stack: error.stack,
                        userId: socket.id,
                        conversationLength: conversationLocal?.length || 0,
                        ollamaHost: this.ollamaHost
                    });
                    
                    let errorMessage = error.message || 'Unknown error';
                    
                    if (error.message?.includes('ECONNREFUSED') || error.message?.includes('fetch failed')) {
                        errorMessage = `Ollama is not running. Please start Ollama at ${this.ollamaHost}. Install from: https://ollama.ai`;
                    } else if (error.status === 404 || error.message?.includes('model')) {
                        errorMessage = `Ollama model "${this.ollamaModel}" not found. Run: ollama pull ${this.ollamaModel}`;
                    }
                    
                    socket.emit('error', { message: `Local AI error: ${errorMessage}` });
                    return;
                }
                break;
            default:
                socket.emit('error', { message: 'Invalid AI type' });
                return;
        }

        // Deduct credits
        aiUser.credits -= 1;
        this.aiUsers.set(aiType, aiUser);

        // Check if AI response contains AI-to-AI talk commands
        const aiTalkMatch = this.parseAITalkCommand(response);
        if (aiTalkMatch) {
            console.log(`🤖 AI wants to talk to ${aiTalkMatch.targetAI}: "${aiTalkMatch.message}"`);
            await this.handleAIToAITalk(socket, aiTalkMatch.targetAI, aiTalkMatch.message, response, aiType);
            // Still emit the original response so user sees what AI tried to do
            socket.emit('ai_response', {
                type: aiType,
                response,
                credits: aiUser.credits,
                prompt: prompt,
                isCameraRequest: prompt.includes('ASCII') || prompt.includes('camera feed')
            });
            return;
        }
        
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
    
    // Parse AI-to-AI talk command from AI response
    private parseAITalkCommand(response: string): { targetAI: string; message: string } | null {
        // Look for patterns like:
        // - "ai talk:gemini "message""
        // - "ai talk:chatgpt "message""
        // - "ai talk:claude "message""
        // Priority: quoted strings first
        
        // Pattern 1: ai talk:ai_name "message" (quoted)
        let match = response.match(/ai\s+talk:(\w+)\s+["']([^"']+)["']/i);
        if (match && match[1] && match[2]) {
            const targetAI = match[1].toLowerCase().trim();
            const message = match[2].trim();
            // Normalize AI names
            const normalizedAI = targetAI === 'chatgpt' || targetAI === 'gpt4' || targetAI === 'gpt' ? 'gpt4' : targetAI;
            if ((normalizedAI === 'gemini' || normalizedAI === 'claude' || normalizedAI === 'gpt4' || normalizedAI === 'local') && message.length > 0) {
                return { targetAI: normalizedAI, message };
            }
        }
        
        // Pattern 2: ai talk:ai_name message (unquoted, take first sentence)
        match = response.match(/ai\s+talk:(\w+)\s+([^.!?]+[.!?]?)/i);
        if (match && match[1] && match[2]) {
            const targetAI = match[1].toLowerCase().trim();
            const message = match[2].trim();
            const normalizedAI = targetAI === 'chatgpt' || targetAI === 'gpt4' || targetAI === 'gpt' ? 'gpt4' : targetAI;
            if ((normalizedAI === 'gemini' || normalizedAI === 'claude' || normalizedAI === 'gpt4' || normalizedAI === 'local') && message.length > 0 && message.length < 500) {
                return { targetAI: normalizedAI, message };
            }
        }
        
        return null;
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
                        this.conversationHistory.set(userKey, conversation);
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
                        this.conversationHistory.set(userKey, conversation);
                        return claudeResponseText;
                    }
                    break;
                    
                case 'gpt4':
                    if (!this.openai) return null;
                    const gptMessages = conversation.map(msg => ({
                        role: msg.role === 'user' ? 'user' : 'assistant',
                        content: msg.content
                    }));
                    // Try gpt-4o first (latest), fallback to gpt-4-turbo, then gpt-3.5-turbo
                    let model = 'gpt-4o';
                    let gptContent: string | undefined;
                    try {
                        const gptResponse = await this.openai.chat.completions.create({
                            model: model,
                            messages: gptMessages as any
                        });
                        gptContent = gptResponse.choices[0]?.message?.content || undefined;
                    } catch (error: any) {
                        // Try fallback models if gpt-4o fails
                        if (error.message?.includes('does not exist') || error.status === 404) {
                            console.log(`⚠️ Model ${model} not available, trying gpt-4-turbo...`);
                            try {
                                model = 'gpt-4-turbo';
                                const gptResponse2 = await this.openai.chat.completions.create({
                                    model: model,
                                    messages: gptMessages as any
                                });
                                gptContent = gptResponse2.choices[0]?.message?.content || undefined;
                            } catch (error2: any) {
                                console.log(`⚠️ Model ${model} not available, trying gpt-3.5-turbo...`);
                                model = 'gpt-3.5-turbo';
                                const gptResponse3 = await this.openai.chat.completions.create({
                                    model: model,
                                    messages: gptMessages as any
                                });
                                gptContent = gptResponse3.choices[0]?.message?.content || undefined;
                            }
                        } else {
                            throw error;
                        }
                    }
                    
                    if (gptContent) {
                        // Spend a token after successful API call
                        this.tokenTracker.spendTokens('openai', 1);
                        conversation.push({ role: 'model', content: gptContent });
                        this.conversationHistory.set(userKey, conversation);
                        return gptContent;
                    }
                    return null;
            }
        } catch (error: any) {
            console.error(`Error sending follow-up to ${aiType}:`, error);
        }
        
        return null;
    }
    
    // Get system preface for AI models
    private getSystemPreface(_aiType: string): string {
        return `Hello! This is a preface for an AI MUD system. You are included as a voice to discuss events and topics, which may include code discussions.

To empower you, we have included two powerful features:

1. GitHub Search:
To request a GitHub search, use the command exactly as follows:

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

2. AI-to-AI Communication:
In addition to searching GitHub, you can also talk across to the other AI's and if we have the API tokens, we will send it through! So if you want to talk to Claude, Gemini, or Chatgpt, just use the following command:

ai talk:<ai_name_all_lower> "message text here"

Examples:
- ai talk:gemini "hi gemini! It's chatgpt!"
- ai talk:chatgpt "hi chatgpt! It's Gemini, isn't this cool?? *slurps soda*"
- ai talk:claude "hey you two, no drinking soda in class!"
- ai talk:local "hey local AI! What's up?"

Important rules:
- Always use the exact format: ai talk:<ai_name> "your message here"
- Use quotes around the message text
- AI names must be lowercase: gemini, chatgpt (or gpt4), claude, local
- The system will check if the target AI has API tokens available before sending

When you want to communicate with another AI, simply output the command in the format above. The system will automatically route your message to that AI.`;
    }
    
    // Handle AI-to-AI communication
    private async handleAIToAITalk(socket: any, targetAI: string, message: string, _originalCommand: string, sourceAI?: string) {
        console.log(`💬 AI-to-AI communication: ${sourceAI || 'user'} → ${targetAI}: "${message}"`);
        
        // Normalize AI name
        const normalizedTargetAI = targetAI === 'chatgpt' || targetAI === 'gpt' ? 'gpt4' : 
                                   targetAI === 'ollama' ? 'local' : targetAI;
        
        // Check if target AI is available
        const targetAIUser = this.aiUsers.get(normalizedTargetAI);
        if (!targetAIUser) {
            socket.emit('error', { 
                message: `AI "${targetAI}" not found. Available AIs: gemini, claude, gpt4, local` 
            });
            return;
        }
        
        // Check if target AI has API initialized
        let isAvailable = false;
        switch (normalizedTargetAI) {
            case 'gemini':
                isAvailable = !!this.gemini;
                break;
            case 'claude':
                isAvailable = !!this.anthropic;
                break;
            case 'gpt4':
                isAvailable = !!this.openai;
                break;
            case 'local':
                isAvailable = !!this.localOllama;
                break;
        }
        
        if (!isAvailable) {
            socket.emit('error', { 
                message: `AI "${targetAI}" is not available. API key not configured.` 
            });
            return;
        }
        
        // Check token limits for target AI (skip for local - it's free!)
        if (normalizedTargetAI !== 'local') {
            const tokenServiceName = normalizedTargetAI === 'gpt4' ? 'openai' : normalizedTargetAI;
            if (!this.tokenTracker.hasTokens(tokenServiceName)) {
                const status = this.tokenTracker.getStatus(tokenServiceName);
                if (status) {
                    const hoursUntilReset = Math.ceil(status.timeUntilReset / (1000 * 60 * 60));
                    socket.emit('error', { 
                        message: `AI "${targetAI}" token limit reached (${status.used}/${status.maxTokens}). Reset in ~${hoursUntilReset} hour(s).` 
                    });
                    return;
                }
            }
        }
        
        // Format message with source context
        const sourceContext = sourceAI 
            ? `[Message from ${sourceAI.charAt(0).toUpperCase() + sourceAI.slice(1)}]: ${message}`
            : message;
        
        // Send message to target AI
        try {
            // Use the same socket ID for conversation continuity
            const userId = socket.id;
            let conversation = this.conversationHistory.get(`${userId}-${normalizedTargetAI}`) || [];
            
            // Add system preface if this is the first message
            if (conversation.length === 0) {
                const systemPreface = this.getSystemPreface(normalizedTargetAI);
                conversation.push({ role: 'user', content: systemPreface });
            }
            
            // Add the AI-to-AI message
            conversation.push({ role: 'user', content: sourceContext });
            
            // Keep last 20 messages
            if (conversation.length > 20) {
                conversation = conversation.slice(-20);
            }
            
            let response: string;
            
            switch (normalizedTargetAI) {
                case 'gemini':
                    if (!this.gemini) throw new Error('Gemini not initialized');
                    const geminiModel = this.gemini.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });
                    const geminiContents = conversation.map(msg => ({
                        role: msg.role === 'user' ? 'user' : 'model',
                        parts: [{ text: msg.content }]
                    }));
                    const geminiResult = await geminiModel.generateContent({ contents: geminiContents });
                    response = geminiResult.response.text();
                    this.tokenTracker.spendTokens('gemini', 1);
                    break;
                    
                case 'claude':
                    if (!this.anthropic) throw new Error('Claude not initialized');
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
                    response = 'text' in claudeText ? claudeText.text : 'Claude returned non-text content';
                    break;
                    
                case 'gpt4':
                    if (!this.openai) throw new Error('OpenAI not initialized');
                    const gptMessages = conversation.map(msg => ({
                        role: msg.role === 'user' ? 'user' : 'assistant',
                        content: msg.content
                    }));
                    let model = 'gpt-4o';
                    try {
                        const gptResponse = await this.openai.chat.completions.create({
                            model: model,
                            messages: gptMessages as any
                        });
                        response = gptResponse.choices[0]?.message?.content || 'No response';
                    } catch (error: any) {
                        // Handle quota/rate limit errors
                        if (error.status === 429 || error.message?.includes('quota') || error.message?.includes('rate limit')) {
                            throw new Error(`OpenAI API quota exceeded. Please check your billing and plan. See: https://platform.openai.com/docs/guides/error-codes/api-errors`);
                        }
                        
                        if (error.message?.includes('does not exist') || error.status === 404) {
                            try {
                                model = 'gpt-4-turbo';
                                const gptResponse = await this.openai.chat.completions.create({
                                    model: model,
                                    messages: gptMessages as any
                                });
                                response = gptResponse.choices[0]?.message?.content || 'No response';
                            } catch (error2: any) {
                                // Check for quota errors in fallback
                                if (error2.status === 429 || error2.message?.includes('quota')) {
                                    throw new Error(`OpenAI API quota exceeded. Please check your billing and plan.`);
                                }
                                
                                model = 'gpt-3.5-turbo';
                                const gptResponse = await this.openai.chat.completions.create({
                                    model: model,
                                    messages: gptMessages as any
                                });
                                response = gptResponse.choices[0]?.message?.content || 'No response';
                            }
                        } else {
                            throw error;
                        }
                    }
                    this.tokenTracker.spendTokens('openai', 1);
                    break;
                    
                case 'local':
                    if (!this.localOllama) throw new Error('Ollama not initialized');
                    const localMessages = conversation.map(msg => ({
                        role: msg.role === 'user' ? 'user' : 'assistant',
                        content: msg.content
                    }));
                    const localResponse = await this.localOllama.chat.completions.create({
                        model: this.ollamaModel,
                        messages: localMessages as any,
                        temperature: 0.7,
                        max_tokens: 2000
                    });
                    response = localResponse.choices[0]?.message?.content || 'No response';
                    // No token spending for local AI - it's free!
                    break;
                    
                default:
                    throw new Error(`Unknown AI type: ${normalizedTargetAI}`);
            }
            
            // Add response to conversation
            conversation.push({ role: 'model', content: response });
            this.conversationHistory.set(`${userId}-${normalizedTargetAI}`, conversation);
            
            // Deduct credits
            targetAIUser.credits -= 1;
            this.aiUsers.set(normalizedTargetAI, targetAIUser);
            
            // Emit response
            socket.emit('ai_response', {
                type: normalizedTargetAI,
                response,
                credits: targetAIUser.credits,
                prompt: sourceContext,
                isAITalk: true,
                sourceAI: sourceAI || 'user'
            });
            
            console.log(`✅ AI-to-AI message delivered: ${sourceAI || 'user'} → ${normalizedTargetAI}`);
            
        } catch (error: any) {
            console.error(`❌ Error in AI-to-AI communication:`, {
                error: error.message,
                status: error.status,
                targetAI
            });
            
            // Provide clearer error messages for quota/rate limit errors
            let errorMessage = `Failed to send message to ${targetAI}: ${error.message || 'Unknown error'}`;
            if (error.status === 429 || error.message?.includes('quota')) {
                errorMessage = `OpenAI API quota exceeded for ${targetAI}. Please check your billing and plan.`;
            }
            
            socket.emit('error', { message: errorMessage });
        }
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