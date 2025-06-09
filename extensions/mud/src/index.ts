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
    private octokit: Octokit;
    private gemini: GoogleGenerativeAI;
    private openai: OpenAI;
    private anthropic: Anthropic;
    private browser: any;
    private aiUsers: Map<string, AIUser> = new Map();
    private messageQueue: MUDMessage[] = [];
    private speechTracker: SpeechTracker;
    private weatherTimeService: WeatherTimeService;
    private audioChat: AudioChat;

    constructor() {
        this.initializeGitHub();
        this.initializeAI();
        this.speechTracker = new SpeechTracker();
        this.weatherTimeService = new WeatherTimeService();
        this.audioChat = new AudioChat();
        this.setupSocketHandlers();
        this.setupRoutes();
    }

    private async initializeGitHub() {
        this.octokit = new Octokit({
            auth: process.env.GITHUB_TOKEN
        });
    }

    private async initializeAI() {
        // Initialize Gemini
        this.gemini = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

        // Initialize OpenAI
        this.openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY
        });

        // Initialize Anthropic
        this.anthropic = new Anthropic({
            apiKey: process.env.ANTHROPIC_API_KEY
        });

        // Initialize Playwright browser
        this.browser = await chromium.launch();
    }

    private setupSocketHandlers() {
        this.io.on('connection', (socket: Socket) => {
            console.log('Client connected:', socket.id);

            socket.on('initialize', () => {
                this.handleInitialize(socket);
            });

            socket.on('command', async (command: string) => {
                await this.handleCommand(socket, command);
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

            socket.on('disconnect', () => {
                console.log('Client disconnected:', socket.id);
            });
        });
    }

    private setupRoutes() {
        this.app.get('/health', (req: Request, res: Response) => {
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
    }

    private handleInitialize(socket: any) {
        // Create AI user profiles
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
        socket.emit('initialized', { users: aiUsers });
    }

    private async handleCommand(socket: any, command: string) {
        try {
            // Parse command
            const [action, ...args] = command.split(' ');

            switch (action) {
                case 'github':
                    await this.handleGitHubCommand(socket, args);
                    break;
                case 'ai':
                    await this.handleAICommand(socket, args);
                    break;
                default:
                    socket.emit('error', { message: 'Unknown command' });
            }
        } catch (error) {
            socket.emit('error', { message: error.message });
        }
    }

    private async handleGitHubCommand(socket: any, args: string[]) {
        const [action, ...params] = args;

        switch (action) {
            case 'clone':
                const [repo] = params;
                const { data: repoData } = await this.octokit.repos.get({
                    owner: repo.split('/')[0],
                    repo: repo.split('/')[1]
                });
                socket.emit('github_response', { data: repoData });
                break;
            case 'search':
                const [query] = params;
                const { data: searchResults } = await this.octokit.search.repos({
                    q: query
                });
                socket.emit('github_response', { data: searchResults });
                break;
            default:
                socket.emit('error', { message: 'Unknown GitHub command' });
        }
    }

    private async handleAICommand(socket: any, args: string[]) {
        const [aiType, ...message] = args;
        const aiUser = this.aiUsers.get(aiType);

        if (!aiUser || aiUser.credits <= 0) {
            socket.emit('error', { message: 'Insufficient credits or invalid AI type' });
            return;
        }

        const prompt = message.join(' ');
        let response: string;

        switch (aiType) {
            case 'gemini':
                const geminiModel = this.gemini.getGenerativeModel({ model: 'gemini-pro' });
                const geminiResult = await geminiModel.generateContent(prompt);
                response = geminiResult.response.text();
                break;
            case 'claude':
                const claudeResponse = await this.anthropic.messages.create({
                    model: 'claude-3-opus-20240229',
                    max_tokens: 1000,
                    messages: [{ role: 'user', content: prompt }]
                });
                response = claudeResponse.content[0].text;
                break;
            case 'gpt4':
                const gptResponse = await this.openai.chat.completions.create({
                    model: 'gpt-4',
                    messages: [{ role: 'user', content: prompt }]
                });
                response = gptResponse.choices[0].message.content;
                break;
            default:
                socket.emit('error', { message: 'Invalid AI type' });
                return;
        }

        // Deduct credits
        aiUser.credits -= 1;
        this.aiUsers.set(aiType, aiUser);

        socket.emit('ai_response', {
            type: aiType,
            response,
            credits: aiUser.credits
        });
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