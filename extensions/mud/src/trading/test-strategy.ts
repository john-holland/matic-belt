import { TradingStrategy } from './strategy';

async function testStrategy() {
    // Create strategy with default configuration
    const strategy = new TradingStrategy({
        rsiPeriod: 14,
        rsiOverbought: 70,
        rsiOversold: 30,
        macdFastPeriod: 12,
        macdSlowPeriod: 26,
        macdSignalPeriod: 9,
        bollingerPeriod: 20,
        bollingerStdDev: 2
    });

    // Sample market data (BTC/USD prices over time)
    const marketData = {
        prices: [
            50000, 51000, 49000, 48000, 47000, 46000, 45000, 44000, 43000, 42000,
            41000, 40000, 39000, 38000, 37000, 36000, 35000, 34000, 33000, 32000,
            31000, 30000, 29000, 28000, 27000, 26000, 25000, 24000, 23000, 22000,
            21000, 20000, 19000, 18000, 17000, 16000, 15000, 14000, 13000, 12000,
            11000, 10000, 9000, 8000, 7000, 6000, 5000, 4000, 3000, 2000
        ],
        price: 2000 // Current price
    };

    // Generate trading signal
    const signal = strategy.generateSignal(marketData);
    console.log('Trading Signal:', signal);

    // Test with different market conditions
    const bullishData = {
        prices: [
            2000, 2100, 2200, 2300, 2400, 2500, 2600, 2700, 2800, 2900,
            3000, 3100, 3200, 3300, 3400, 3500, 3600, 3700, 3800, 3900,
            4000, 4100, 4200, 4300, 4400, 4500, 4600, 4700, 4800, 4900,
            5000, 5100, 5200, 5300, 5400, 5500, 5600, 5700, 5800, 5900,
            6000, 6100, 6200, 6300, 6400, 6500, 6600, 6700, 6800, 6900
        ],
        price: 6900
    };

    const bearishData = {
        prices: [
            6900, 6800, 6700, 6600, 6500, 6400, 6300, 6200, 6100, 6000,
            5900, 5800, 5700, 5600, 5500, 5400, 5300, 5200, 5100, 5000,
            4900, 4800, 4700, 4600, 4500, 4400, 4300, 4200, 4100, 4000,
            3900, 3800, 3700, 3600, 3500, 3400, 3300, 3200, 3100, 3000,
            2900, 2800, 2700, 2600, 2500, 2400, 2300, 2200, 2100, 2000
        ],
        price: 2000
    };

    // Test bullish market
    const bullishSignal = strategy.generateSignal(bullishData);
    console.log('Bullish Market Signal:', bullishSignal);

    // Test bearish market
    const bearishSignal = strategy.generateSignal(bearishData);
    console.log('Bearish Market Signal:', bearishSignal);

    // Test with insufficient data
    const insufficientData = {
        prices: [2000, 2100, 2200],
        price: 2200
    };

    const insufficientSignal = strategy.generateSignal(insufficientData);
    console.log('Insufficient Data Signal:', insufficientSignal);
}

// Run the test
testStrategy().catch(console.error); 