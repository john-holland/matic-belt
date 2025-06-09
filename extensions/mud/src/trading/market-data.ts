import WebSocket from 'ws';
import axios from 'axios';

interface MarketDataConfig {
    symbol: string;
    interval: string;
    exchange: string;
    apiKey?: string;
    apiSecret?: string;
}

interface Candle {
    timestamp: number;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
}

interface MarketData {
    price: number;
    prices: number[];
    volume: number;
    timestamp: number;
    candles: Candle[];
}

export class MarketDataProvider {
    private config: MarketDataConfig;
    private ws: WebSocket | null = null;
    private candles: Candle[] = [];
    private lastPrice: number = 0;
    private isConnected: boolean = false;
    private reconnectAttempts: number = 0;
    private maxReconnectAttempts: number = 5;
    private reconnectDelay: number = 1000;

    constructor(config: MarketDataConfig) {
        this.config = config;
    }

    public async connect(): Promise<void> {
        try {
            // Initialize WebSocket connection
            this.ws = new WebSocket(this.getWebSocketUrl());
            
            this.ws.on('open', () => {
                console.log('WebSocket connected');
                this.isConnected = true;
                this.reconnectAttempts = 0;
                this.subscribe();
            });

            this.ws.on('message', (data: string) => {
                this.handleMessage(JSON.parse(data));
            });

            this.ws.on('close', () => {
                this.isConnected = false;
                this.handleDisconnect();
            });

            this.ws.on('error', (error) => {
                console.error('WebSocket error:', error);
                this.handleDisconnect();
            });

            // Load historical data
            await this.loadHistoricalData();
        } catch (error) {
            console.error('Connection error:', error);
            this.handleDisconnect();
        }
    }

    private getWebSocketUrl(): string {
        // Implement exchange-specific WebSocket URL
        switch (this.config.exchange.toLowerCase()) {
            case 'binance':
                return `wss://stream.binance.com:9443/ws/${this.config.symbol.toLowerCase()}@kline_${this.config.interval}`;
            case 'coinbase':
                return `wss://ws-feed.pro.coinbase.com`;
            default:
                throw new Error(`Unsupported exchange: ${this.config.exchange}`);
        }
    }

    private subscribe(): void {
        if (!this.ws) return;

        const subscription = {
            type: 'subscribe',
            channels: [{
                name: 'ticker',
                product_ids: [this.config.symbol]
            }]
        };

        this.ws.send(JSON.stringify(subscription));
    }

    private async loadHistoricalData(): Promise<void> {
        try {
            const response = await axios.get(this.getHistoricalDataUrl());
            this.candles = this.parseHistoricalData(response.data);
            this.updatePriceData();
        } catch (error) {
            console.error('Error loading historical data:', error);
        }
    }

    private getHistoricalDataUrl(): string {
        // Implement exchange-specific historical data URL
        switch (this.config.exchange.toLowerCase()) {
            case 'binance':
                return `https://api.binance.com/api/v3/klines?symbol=${this.config.symbol}&interval=${this.config.interval}&limit=1000`;
            case 'coinbase':
                return `https://api.pro.coinbase.com/products/${this.config.symbol}/candles?granularity=${this.getGranularity()}`;
            default:
                throw new Error(`Unsupported exchange: ${this.config.exchange}`);
        }
    }

    private getGranularity(): number {
        // Convert interval to seconds
        const match = this.config.interval.match(/(\d+)([mhd])/);
        if (!match) return 60;

        const [, value, unit] = match;
        const num = parseInt(value);

        switch (unit) {
            case 'm': return num * 60;
            case 'h': return num * 3600;
            case 'd': return num * 86400;
            default: return 60;
        }
    }

    private parseHistoricalData(data: any): Candle[] {
        // Implement exchange-specific data parsing
        switch (this.config.exchange.toLowerCase()) {
            case 'binance':
                return data.map((candle: any[]) => ({
                    timestamp: candle[0],
                    open: parseFloat(candle[1]),
                    high: parseFloat(candle[2]),
                    low: parseFloat(candle[3]),
                    close: parseFloat(candle[4]),
                    volume: parseFloat(candle[5])
                }));
            case 'coinbase':
                return data.map((candle: any[]) => ({
                    timestamp: candle[0] * 1000,
                    open: candle[3],
                    high: candle[2],
                    low: candle[1],
                    close: candle[4],
                    volume: candle[5]
                }));
            default:
                throw new Error(`Unsupported exchange: ${this.config.exchange}`);
        }
    }

    private handleMessage(data: any): void {
        // Implement exchange-specific message handling
        switch (this.config.exchange.toLowerCase()) {
            case 'binance':
                if (data.k) {
                    this.updateCandle(data.k);
                }
                break;
            case 'coinbase':
                if (data.type === 'ticker') {
                    this.updatePrice(data.price);
                }
                break;
        }
    }

    private updateCandle(candle: any): void {
        const newCandle: Candle = {
            timestamp: candle.t,
            open: parseFloat(candle.o),
            high: parseFloat(candle.h),
            low: parseFloat(candle.l),
            close: parseFloat(candle.c),
            volume: parseFloat(candle.v)
        };

        // Update or add candle
        const index = this.candles.findIndex(c => c.timestamp === newCandle.timestamp);
        if (index >= 0) {
            this.candles[index] = newCandle;
        } else {
            this.candles.push(newCandle);
        }

        // Keep only last 1000 candles
        if (this.candles.length > 1000) {
            this.candles.shift();
        }

        this.updatePriceData();
    }

    private updatePrice(price: string): void {
        this.lastPrice = parseFloat(price);
        this.updatePriceData();
    }

    private updatePriceData(): void {
        if (this.candles.length > 0) {
            this.lastPrice = this.candles[this.candles.length - 1].close;
        }
    }

    private handleDisconnect(): void {
        this.isConnected = false;
        
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            console.log(`Reconnecting... Attempt ${this.reconnectAttempts}`);
            setTimeout(() => this.connect(), this.reconnectDelay * this.reconnectAttempts);
        } else {
            console.error('Max reconnection attempts reached');
        }
    }

    public getMarketData(): MarketData {
        return {
            price: this.lastPrice,
            prices: this.candles.map(c => c.close),
            volume: this.candles.reduce((sum, c) => sum + c.volume, 0),
            timestamp: Date.now(),
            candles: this.candles
        };
    }

    public disconnect(): void {
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
        this.isConnected = false;
    }
} 