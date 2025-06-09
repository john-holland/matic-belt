interface StrategyConfig {
    rsiPeriod: number;
    rsiOverbought: number;
    rsiOversold: number;
    macdFastPeriod: number;
    macdSlowPeriod: number;
    macdSignalPeriod: number;
    bollingerPeriod: number;
    bollingerStdDev: number;
}

export class TradingStrategy {
    private config: StrategyConfig;

    constructor(config: StrategyConfig) {
        this.config = config;
    }

    public generateSignal(marketData: any): 'long' | 'short' | null {
        // Check if we have enough data
        if (!this.hasEnoughData(marketData)) {
            return null;
        }

        // Get technical indicators
        const rsi = this.calculateRSI(marketData);
        const macd = this.calculateMACD(marketData);
        const bollinger = this.calculateBollingerBands(marketData);

        // Generate signals based on indicator combinations
        const signals = [
            this.checkRSISignal(rsi),
            this.checkMACDSignal(macd),
            this.checkBollingerSignal(marketData.price, bollinger)
        ];

        // Count signals
        const longSignals = signals.filter(s => s === 'long').length;
        const shortSignals = signals.filter(s => s === 'short').length;

        // Require at least 2 confirming signals
        if (longSignals >= 2) return 'long';
        if (shortSignals >= 2) return 'short';

        return null;
    }

    private hasEnoughData(marketData: any): boolean {
        // Check if we have enough price data for all indicators
        const minPeriod = Math.max(
            this.config.rsiPeriod,
            this.config.macdSlowPeriod,
            this.config.bollingerPeriod
        );

        return marketData.prices && marketData.prices.length >= minPeriod;
    }

    private calculateRSI(marketData: any): number {
        const prices = marketData.prices;
        const period = this.config.rsiPeriod;

        // Calculate price changes
        const changes = prices.slice(1).map((price: number, i: number) => 
            price - prices[i]
        );

        // Calculate average gains and losses
        let avgGain = 0;
        let avgLoss = 0;

        for (let i = 0; i < period; i++) {
            if (changes[i] > 0) {
                avgGain += changes[i];
            } else {
                avgLoss -= changes[i];
            }
        }

        avgGain /= period;
        avgLoss /= period;

        // Calculate RSI
        if (avgLoss === 0) return 100;
        const rs = avgGain / avgLoss;
        return 100 - (100 / (1 + rs));
    }

    private calculateMACD(marketData: any): { value: number; signal: number; histogram: number } {
        const prices = marketData.prices;
        const fastPeriod = this.config.macdFastPeriod;
        const slowPeriod = this.config.macdSlowPeriod;
        const signalPeriod = this.config.macdSignalPeriod;

        // Calculate EMAs
        const fastEMA = this.calculateEMA(prices, fastPeriod);
        const slowEMA = this.calculateEMA(prices, slowPeriod);

        // Calculate MACD line
        const macdLine = fastEMA - slowEMA;

        // Calculate signal line
        const signalLine = this.calculateEMA([macdLine], signalPeriod);

        // Calculate histogram
        const histogram = macdLine - signalLine;

        return {
            value: macdLine,
            signal: signalLine,
            histogram
        };
    }

    private calculateBollingerBands(marketData: any): { upper: number; middle: number; lower: number } {
        const prices = marketData.prices;
        const period = this.config.bollingerPeriod;
        const stdDev = this.config.bollingerStdDev;

        // Calculate SMA
        const sma = this.calculateSMA(prices, period);

        // Calculate standard deviation
        const squaredDiffs = prices.slice(-period).map((price: number) => 
            Math.pow(price - sma, 2)
        );
        const variance = squaredDiffs.reduce((a: number, b: number) => a + b) / period;
        const standardDeviation = Math.sqrt(variance);

        return {
            upper: sma + (standardDeviation * stdDev),
            middle: sma,
            lower: sma - (standardDeviation * stdDev)
        };
    }

    private calculateEMA(prices: number[], period: number): number {
        const multiplier = 2 / (period + 1);
        let ema = prices[0];

        for (let i = 1; i < prices.length; i++) {
            ema = (prices[i] - ema) * multiplier + ema;
        }

        return ema;
    }

    private calculateSMA(prices: number[], period: number): number {
        const sum = prices.slice(-period).reduce((a: number, b: number) => a + b);
        return sum / period;
    }

    private checkRSISignal(rsi: number): 'long' | 'short' | null {
        if (rsi <= this.config.rsiOversold) return 'long';
        if (rsi >= this.config.rsiOverbought) return 'short';
        return null;
    }

    private checkMACDSignal(macd: { value: number; signal: number; histogram: number }): 'long' | 'short' | null {
        if (macd.histogram > 0 && macd.value > macd.signal) return 'long';
        if (macd.histogram < 0 && macd.value < macd.signal) return 'short';
        return null;
    }

    private checkBollingerSignal(price: number, bands: { upper: number; middle: number; lower: number }): 'long' | 'short' | null {
        if (price <= bands.lower) return 'long';
        if (price >= bands.upper) return 'short';
        return null;
    }
} 