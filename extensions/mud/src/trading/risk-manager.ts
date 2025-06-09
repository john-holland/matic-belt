interface RiskConfig {
    maxPositionSize: number;      // Maximum position size in base currency
    maxRiskPerTrade: number;      // Maximum risk per trade as percentage of account
    maxDrawdown: number;          // Maximum drawdown allowed as percentage
    stopLossPercentage: number;   // Stop loss percentage from entry
    takeProfitPercentage: number; // Take profit percentage from entry
    trailingStopPercentage: number; // Trailing stop percentage
}

interface Position {
    entryPrice: number;
    size: number;
    type: 'long' | 'short';
    stopLoss: number;
    takeProfit: number;
    trailingStop: number;
}

export class RiskManager {
    private config: RiskConfig;
    private accountBalance: number;
    private currentDrawdown: number;
    private positions: Map<string, Position>;

    constructor(config: RiskConfig, initialBalance: number) {
        this.config = config;
        this.accountBalance = initialBalance;
        this.currentDrawdown = 0;
        this.positions = new Map();
    }

    public calculatePositionSize(price: number, volatility: number): number {
        // Calculate risk amount based on account balance and max risk per trade
        const riskAmount = this.accountBalance * (this.config.maxRiskPerTrade / 100);

        // Adjust position size based on volatility
        const volatilityAdjustment = Math.max(0.5, Math.min(1.5, 1 / volatility));
        
        // Calculate base position size
        let positionSize = (riskAmount / price) * volatilityAdjustment;

        // Ensure position size doesn't exceed maximum
        positionSize = Math.min(positionSize, this.config.maxPositionSize);

        return positionSize;
    }

    public calculateStopLoss(entryPrice: number, type: 'long' | 'short'): number {
        const stopLossPercentage = this.config.stopLossPercentage / 100;
        
        if (type === 'long') {
            return entryPrice * (1 - stopLossPercentage);
        } else {
            return entryPrice * (1 + stopLossPercentage);
        }
    }

    public calculateTakeProfit(entryPrice: number, type: 'long' | 'short'): number {
        const takeProfitPercentage = this.config.takeProfitPercentage / 100;
        
        if (type === 'long') {
            return entryPrice * (1 + takeProfitPercentage);
        } else {
            return entryPrice * (1 - takeProfitPercentage);
        }
    }

    public calculateTrailingStop(currentPrice: number, type: 'long' | 'short'): number {
        const trailingStopPercentage = this.config.trailingStopPercentage / 100;
        
        if (type === 'long') {
            return currentPrice * (1 - trailingStopPercentage);
        } else {
            return currentPrice * (1 + trailingStopPercentage);
        }
    }

    public updateTrailingStop(positionId: string, currentPrice: number): void {
        const position = this.positions.get(positionId);
        if (!position) return;

        const newTrailingStop = this.calculateTrailingStop(currentPrice, position.type);
        
        if (position.type === 'long' && newTrailingStop > position.trailingStop) {
            position.trailingStop = newTrailingStop;
        } else if (position.type === 'short' && newTrailingStop < position.trailingStop) {
            position.trailingStop = newTrailingStop;
        }
    }

    public checkStopLoss(positionId: string, currentPrice: number): boolean {
        const position = this.positions.get(positionId);
        if (!position) return false;

        if (position.type === 'long') {
            return currentPrice <= position.trailingStop;
        } else {
            return currentPrice >= position.trailingStop;
        }
    }

    public checkTakeProfit(positionId: string, currentPrice: number): boolean {
        const position = this.positions.get(positionId);
        if (!position) return false;

        if (position.type === 'long') {
            return currentPrice >= position.takeProfit;
        } else {
            return currentPrice <= position.takeProfit;
        }
    }

    public calculatePnL(positionId: string, currentPrice: number): number {
        const position = this.positions.get(positionId);
        if (!position) return 0;

        const priceDifference = currentPrice - position.entryPrice;
        const pnl = position.type === 'long' 
            ? priceDifference * position.size
            : -priceDifference * position.size;

        return pnl;
    }

    public updateDrawdown(currentBalance: number): void {
        const drawdown = ((this.accountBalance - currentBalance) / this.accountBalance) * 100;
        this.currentDrawdown = Math.max(this.currentDrawdown, drawdown);
    }

    public canOpenNewPosition(): boolean {
        return this.currentDrawdown < this.config.maxDrawdown;
    }

    public addPosition(positionId: string, position: Position): void {
        this.positions.set(positionId, position);
    }

    public removePosition(positionId: string): void {
        this.positions.delete(positionId);
    }

    public getPosition(positionId: string): Position | undefined {
        return this.positions.get(positionId);
    }

    public getAllPositions(): Position[] {
        return Array.from(this.positions.values());
    }

    public updateAccountBalance(newBalance: number): void {
        this.accountBalance = newBalance;
        this.updateDrawdown(newBalance);
    }
} 