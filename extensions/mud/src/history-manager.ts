import * as fs from 'fs';
import * as path from 'path';

export class HistoryManager {
    private historyFile: string;
    private maxHistorySize: number = 1000;
    private history: string[] = [];

    constructor() {
        // Store history in a data directory
        const dataDir = path.join(__dirname, '../data');
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
        }
        this.historyFile = path.join(dataDir, 'command-history.txt');
        this.loadHistory();
    }

    private loadHistory(): void {
        try {
            if (fs.existsSync(this.historyFile)) {
                const content = fs.readFileSync(this.historyFile, 'utf-8');
                this.history = content
                    .split('\n')
                    .filter(line => line.trim().length > 0)
                    .slice(-this.maxHistorySize); // Keep last N entries
            }
        } catch (error) {
            console.error('Failed to load command history:', error);
            this.history = [];
        }
    }

    public addCommand(command: string): void {
        if (!command || command.trim().length === 0) {
            return;
        }

        const trimmed = command.trim();
        
        // Don't add if it's the same as the last command
        if (this.history.length > 0 && this.history[this.history.length - 1] === trimmed) {
            return;
        }

        this.history.push(trimmed);
        
        // Keep history size manageable
        if (this.history.length > this.maxHistorySize) {
            this.history = this.history.slice(-this.maxHistorySize);
        }

        this.saveHistory();
    }

    private saveHistory(): void {
        try {
            fs.writeFileSync(this.historyFile, this.history.join('\n') + '\n', 'utf-8');
        } catch (error) {
            console.error('Failed to save command history:', error);
        }
    }

    public getHistory(): string[] {
        return [...this.history]; // Return a copy
    }

    public getHistoryByIndex(index: number): string | null {
        if (index < 0 || index >= this.history.length) {
            return null;
        }
        return this.history[index];
    }

    public getLastN(n: number): string[] {
        return this.history.slice(-n);
    }

    public clearHistory(): void {
        this.history = [];
        this.saveHistory();
    }
}

