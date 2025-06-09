import { MarketDataProvider } from './market-data';

async function testMarketData() {
    // Create market data provider for BTC/USD on Binance
    const marketData = new MarketDataProvider({
        symbol: 'BTCUSDT',
        interval: '1m',
        exchange: 'binance'
    });

    // Connect to WebSocket and load historical data
    await marketData.connect();

    // Set up periodic data logging
    const logInterval = setInterval(() => {
        const data = marketData.getMarketData();
        console.log('Current Price:', data.price);
        console.log('24h Volume:', data.volume);
        console.log('Last Update:', new Date(data.timestamp).toISOString());
        console.log('Candle Count:', data.candles.length);
        console.log('---');
    }, 5000);

    // Handle cleanup
    process.on('SIGINT', () => {
        clearInterval(logInterval);
        marketData.disconnect();
        process.exit(0);
    });
}

// Run the test
testMarketData().catch(console.error); 