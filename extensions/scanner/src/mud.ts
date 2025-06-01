import { io, Socket } from 'socket.io-client';

export interface MUDMessage {
    type: 'system' | 'error' | 'success' | 'ai';
    content: string;
    timestamp: number;
}

export class MUDClient {
    private socket: Socket | null;
    private connected: boolean;
    private messageQueue: MUDMessage[];
    private messageHandlers: ((message: MUDMessage) => void)[];

    constructor() {
        this.socket = null;
        this.connected = false;
        this.messageQueue = [];
        this.messageHandlers = [];
    }

    public async connect(): Promise<void> {
        if (this.connected) return;

        return new Promise((resolve, reject) => {
            this.socket = io('http://localhost:3001');

            this.socket.on('connect', () => {
                this.connected = true;
                this.socket?.emit('initialize');
                resolve();
            });

            this.socket.on('disconnect', () => {
                this.connected = false;
            });

            this.socket.on('error', (error: string) => {
                this.handleMessage({
                    type: 'error',
                    content: error,
                    timestamp: Date.now()
                });
            });

            this.socket.on('ai_response', (data: any) => {
                this.handleMessage({
                    type: 'ai',
                    content: `Q: ${data.question}\nA: ${data.answer}`,
                    timestamp: Date.now()
                });
            });

            this.socket.on('connect_error', (error: Error) => {
                reject(error);
            });
        });
    }

    public async disconnect(): Promise<void> {
        if (!this.connected) return;

        return new Promise((resolve) => {
            if (this.socket) {
                this.socket.disconnect();
                this.socket = null;
                this.connected = false;
            }
            resolve();
        });
    }

    public sendCommand(command: string): void {
        if (!this.connected || !this.socket) {
            this.messageQueue.push({
                type: 'error',
                content: 'Not connected to MUD server',
                timestamp: Date.now()
            });
            return;
        }

        this.socket.emit('command', command);
    }

    public onMessage(handler: (message: MUDMessage) => void): void {
        this.messageHandlers.push(handler);
    }

    private handleMessage(message: MUDMessage): void {
        this.messageQueue.push(message);
        this.messageHandlers.forEach(handler => handler(message));
    }

    public getMessageQueue(): MUDMessage[] {
        return [...this.messageQueue];
    }

    public clearMessageQueue(): void {
        this.messageQueue = [];
    }

    public isConnected(): boolean {
        return this.connected;
    }
} 