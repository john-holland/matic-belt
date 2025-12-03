import * as fs from 'fs';
import * as path from 'path';

export interface TokenLimit {
    maxTokens: number;
    refreshPeriodMs: number; // milliseconds (e.g., 24 hours = 86400000)
    tokensUsed: number;
    lastResetDate: string; // ISO date string
    lastSpentDate: string; // ISO date string
    lastDayUsed: string; // Date string in YYYY-MM-DD format - tracks the calendar day tokens were last used
}

export interface TokenTrackerData {
    [serviceName: string]: TokenLimit;
}

export class TokenTracker {
    private dataPath: string;
    private data: TokenTrackerData;

    constructor(dataPath?: string) {
        this.dataPath = dataPath || path.join(__dirname, '../data/token-tracker.json');
        this.data = this.loadData();
    }

    private loadData(): TokenTrackerData {
        try {
            if (fs.existsSync(this.dataPath)) {
                const content = fs.readFileSync(this.dataPath, 'utf-8');
                return JSON.parse(content);
            }
        } catch (error) {
            console.error('Error loading token tracker data:', error);
        }
        return {};
    }

    private saveData(): void {
        try {
            const dir = path.dirname(this.dataPath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
            fs.writeFileSync(this.dataPath, JSON.stringify(this.data, null, 2), 'utf-8');
        } catch (error) {
            console.error('Error saving token tracker data:', error);
        }
    }

    /**
     * Get current date in YYYY-MM-DD format
     */
    private getCurrentDateString(): string {
        const now = new Date();
        return now.toISOString().split('T')[0];
    }

    /**
     * Initialize or update token limit for a service
     */
    public initializeService(serviceName: string, maxTokens: number, refreshPeriodMs: number, tokensUsed: number = 0): void {
        const now = new Date().toISOString();
        const currentDate = this.getCurrentDateString();
        this.data[serviceName] = {
            maxTokens,
            refreshPeriodMs,
            tokensUsed,
            lastResetDate: now,
            lastSpentDate: tokensUsed > 0 ? now : '',
            lastDayUsed: tokensUsed > 0 ? currentDate : ''
        };
        this.saveData();
    }

    /**
     * Check if tokens should be reset based on refresh period
     */
    private checkAndReset(serviceName: string): boolean {
        const service = this.data[serviceName];
        if (!service) return false;

        const lastReset = new Date(service.lastResetDate);
        const now = new Date();
        const timeSinceReset = now.getTime() - lastReset.getTime();

        if (timeSinceReset >= service.refreshPeriodMs) {
            // Before resetting, ensure lastDayUsed is recorded if tokens were used
            if (service.tokensUsed > 0 && !service.lastDayUsed && service.lastSpentDate) {
                // If tokens were used but lastDayUsed wasn't set, extract date from lastSpentDate
                const lastSpent = new Date(service.lastSpentDate);
                service.lastDayUsed = lastSpent.toISOString().split('T')[0];
            } else if (service.tokensUsed > 0 && !service.lastDayUsed) {
                // Fallback: use current date if no lastSpentDate available
                service.lastDayUsed = this.getCurrentDateString();
            }
            // Note: lastDayUsed is preserved through reset to maintain historical record
            
            // Reset tokens
            service.tokensUsed = 0;
            service.lastResetDate = now.toISOString();
            service.lastSpentDate = '';
            // lastDayUsed is NOT cleared - it preserves the calendar day tokens were last used
            this.saveData();
            console.log(`🔄 Token limit reset for ${serviceName}: ${service.maxTokens} tokens available${service.lastDayUsed ? ` (last used: ${service.lastDayUsed})` : ''}`);
            return true;
        }
        return false;
    }

    /**
     * Check if service has tokens available
     */
    public hasTokens(serviceName: string): boolean {
        const service = this.data[serviceName];
        if (!service) {
            console.warn(`⚠️ No token limit configured for ${serviceName}`);
            return true; // Default to allowing if not configured
        }

        this.checkAndReset(serviceName);
        return service.tokensUsed < service.maxTokens;
    }

    /**
     * Get remaining tokens for a service
     */
    public getRemainingTokens(serviceName: string): number {
        const service = this.data[serviceName];
        if (!service) return Infinity;

        this.checkAndReset(serviceName);
        return Math.max(0, service.maxTokens - service.tokensUsed);
    }

    /**
     * Spend tokens (increment usage)
     */
    public spendTokens(serviceName: string, amount: number = 1): boolean {
        const service = this.data[serviceName];
        if (!service) {
            console.warn(`⚠️ No token limit configured for ${serviceName}`);
            return true; // Default to allowing if not configured
        }

        this.checkAndReset(serviceName);

        if (service.tokensUsed + amount > service.maxTokens) {
            return false; // Would exceed limit
        }

        service.tokensUsed += amount;
        const now = new Date();
        service.lastSpentDate = now.toISOString();
        service.lastDayUsed = this.getCurrentDateString(); // Record the calendar day tokens were used
        this.saveData();
        
        console.log(`💳 Spent ${amount} token(s) for ${serviceName}. Remaining: ${this.getRemainingTokens(serviceName)}/${service.maxTokens}`);
        return true;
    }

    /**
     * Get time until next reset
     */
    public getTimeUntilReset(serviceName: string): number {
        const service = this.data[serviceName];
        if (!service) return 0;

        const lastReset = new Date(service.lastResetDate);
        const now = new Date();
        const timeSinceReset = now.getTime() - lastReset.getTime();
        const timeUntilReset = service.refreshPeriodMs - timeSinceReset;

        return Math.max(0, timeUntilReset);
    }

    /**
     * Get status information for a service
     */
    public getStatus(serviceName: string): {
        hasTokens: boolean;
        remaining: number;
        maxTokens: number;
        used: number;
        timeUntilReset: number;
        lastSpentDate: string;
        lastDayUsed: string;
    } | null {
        const service = this.data[serviceName];
        if (!service) return null;

        this.checkAndReset(serviceName);

        return {
            hasTokens: service.tokensUsed < service.maxTokens,
            remaining: this.getRemainingTokens(serviceName),
            maxTokens: service.maxTokens,
            used: service.tokensUsed,
            timeUntilReset: this.getTimeUntilReset(serviceName),
            lastSpentDate: service.lastSpentDate,
            lastDayUsed: service.lastDayUsed || ''
        };
    }

    /**
     * Get all service statuses
     */
    public getAllStatuses(): Record<string, {
        hasTokens: boolean;
        remaining: number;
        maxTokens: number;
        used: number;
        timeUntilReset: number;
        lastSpentDate: string;
        lastDayUsed: string;
    }> {
        const statuses: Record<string, any> = {};
        for (const serviceName in this.data) {
            const status = this.getStatus(serviceName);
            if (status) {
                statuses[serviceName] = status;
            }
        }
        return statuses;
    }
}

