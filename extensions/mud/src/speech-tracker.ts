import { OpenAI } from 'openai';
import { config } from './config';
import { WeatherTimeService } from './services/weather-time';
import { debounce } from './utils/debounce';
import { EventEmitter } from 'events';
import { AutoLogEvent } from './types/auto-log-event';

export interface SpeechEntry {
    id: string;
    userId: string;
    content: string;
    timestamp: number;
    context?: Record<string, any>;
    processed: boolean;
}

export class SpeechTracker extends EventEmitter {
    private openai: OpenAI;
    private weatherTimeService: WeatherTimeService;
    private speechHistory: Map<string, SpeechEntry[]> = new Map();
    private processingQueue: SpeechEntry[] = [];
    private lastWeatherLog: number = 0;
    private lastTimeLog: number = 0;
    private readonly WEATHER_DEBOUNCE = 5 * 60 * 1000; // 5 minutes
    private readonly TIME_DEBOUNCE = 1 * 60 * 1000; // 1 minute

    constructor() {
        super();
        this.openai = new OpenAI({
            apiKey: config.OPENAI_API_KEY
        });
        this.weatherTimeService = new WeatherTimeService();
    }

    public async trackSpeech(userId: string, content: string, context?: Record<string, any>): Promise<SpeechEntry> {
        const entry: SpeechEntry = {
            id: this.generateEntryId(),
            userId,
            content,
            timestamp: Date.now(),
            context,
            processed: false
        };

        // Add to user's speech history
        if (!this.speechHistory.has(userId)) {
            this.speechHistory.set(userId, []);
        }
        this.speechHistory.get(userId)!.push(entry);

        // Check for weather and time keywords
        await this.checkForAutoLogging(entry);

        // Add to processing queue
        this.processingQueue.push(entry);

        // Process the queue asynchronously
        this.processQueue();

        return entry;
    }

    private async checkForAutoLogging(entry: SpeechEntry): Promise<void> {
        const content = entry.content.toLowerCase();
        const now = Date.now();

        // Check for weather keyword
        if (content.includes('weather') && now - this.lastWeatherLog >= this.WEATHER_DEBOUNCE) {
            this.lastWeatherLog = now;
            const weather = await this.weatherTimeService.getWeather();
            this.emitAutoLog({
                type: 'weather',
                data: weather,
                timestamp: now
            });
        }

        // Check for time keyword
        if (content.includes('time') && now - this.lastTimeLog >= this.TIME_DEBOUNCE) {
            this.lastTimeLog = now;
            const time = this.weatherTimeService.getTime();
            this.emitAutoLog({
                type: 'time',
                data: time,
                timestamp: now
            });
        }

        // Check for both keywords
        if ((content.includes('weather') && content.includes('time')) ||
            content.includes('weather and time')) {
            if (now - this.lastWeatherLog >= this.WEATHER_DEBOUNCE ||
                now - this.lastTimeLog >= this.TIME_DEBOUNCE) {
                this.lastWeatherLog = now;
                this.lastTimeLog = now;
                const [weather, time] = await Promise.all([
                    this.weatherTimeService.getWeather(),
                    this.weatherTimeService.getTime()
                ]);
                this.emitAutoLog({
                    type: 'weather-time',
                    data: { weather, time },
                    timestamp: now
                });
            }
        }
    }

    private emitAutoLog = debounce((event: AutoLogEvent) => {
        this.emit('autoLog', event);
    }, 1000);

    private async processQueue(): Promise<void> {
        while (this.processingQueue.length > 0) {
            const entry = this.processingQueue.shift();
            if (entry && !entry.processed) {
                await this.prepareQuery(entry);
            }
        }
    }

    private async prepareQuery(entry: SpeechEntry): Promise<void> {
        try {
            // Get recent context from user's speech history
            const userHistory = this.speechHistory.get(entry.userId) || [];
            const recentEntries = userHistory
                .filter(e => e.id !== entry.id && e.timestamp > Date.now() - 5 * 60 * 1000) // Last 5 minutes
                .map(e => e.content);

            // Prepare context for GPT
            const context = {
                recentSpeech: recentEntries,
                currentEntry: entry.content,
                userContext: entry.context
            };

            // Generate query using GPT
            const response = await this.openai.chat.completions.create({
                model: "gpt-4",
                messages: [
                    {
                        role: "system",
                        content: "You are a query preparation assistant for a MUD system. Your task is to analyze speech and prepare structured queries that can be used to interact with the MUD. Consider the context and recent speech history when preparing queries."
                    },
                    {
                        role: "user",
                        content: JSON.stringify(context)
                    }
                ]
            });

            // Update entry with processed query
            entry.processed = true;
            entry.context = {
                ...entry.context,
                preparedQuery: response.choices[0].message.content
            };

            // Emit event for MUD system to handle the prepared query
            this.emitQueryPrepared(entry);
        } catch (error) {
            console.error('Error preparing query:', error);
            entry.processed = true;
            entry.context = {
                ...entry.context,
                error: 'Failed to prepare query'
            };
        }
    }

    private emitQueryPrepared(entry: SpeechEntry): void {
        this.emit('queryPrepared', {
            userId: entry.userId,
            query: entry.context?.preparedQuery
        });
    }

    public getUserSpeechHistory(userId: string, timeWindow?: number): SpeechEntry[] {
        const history = this.speechHistory.get(userId) || [];
        if (timeWindow) {
            const cutoff = Date.now() - timeWindow;
            return history.filter(entry => entry.timestamp >= cutoff);
        }
        return history;
    }

    private generateEntryId(): string {
        return `speech_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
} 