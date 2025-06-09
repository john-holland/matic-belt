import { RiskManager } from './risk-manager';

async function testRiskManager() {
    // Create risk manager with conservative settings
    const riskManager = new RiskManager({
        maxPositionSize: 1.0,        // 1 BTC
        maxRiskPerTrade: 1.0,        // 1% risk per trade
        maxDrawdown: 10.0,           // 10% maximum drawdown
        stopLossPercentage: 2.0,     // 2% stop loss
        takeProfitPercentage: 4.0,   // 4% take profit
        trailingStopPercentage: 1.0  // 1% trailing stop
    }, 100000); // $100,000 initial balance

    // Test position sizing
    const price = 50000; // BTC price
    const volatility = 0.02; // 2% volatility
    const positionSize = riskManager.calculatePositionSize(price, volatility);
    console.log('Calculated Position Size:', positionSize, 'BTC');

    // Test stop loss and take profit calculations
    const stopLoss = riskManager.calculateStopLoss(price, 'long');
    const takeProfit = riskManager.calculateTakeProfit(price, 'long');
    console.log('Stop Loss:', stopLoss);
    console.log('Take Profit:', takeProfit);

    // Test position management
    const positionId = 'test-position-1';
    const position = {
        entryPrice: price,
        size: positionSize,
        type: 'long' as const,
        stopLoss,
        takeProfit,
        trailingStop: stopLoss
    };

    riskManager.addPosition(positionId, position);
    console.log('Added Position:', riskManager.getPosition(positionId));

    // Test trailing stop updates
    const newPrice = 51000;
    riskManager.updateTrailingStop(positionId, newPrice);
    console.log('Updated Trailing Stop:', riskManager.getPosition(positionId)?.trailingStop);

    // Test PnL calculation
    const pnl = riskManager.calculatePnL(positionId, newPrice);
    console.log('Current PnL:', pnl);

    // Test stop loss and take profit checks
    const stopLossTriggered = riskManager.checkStopLoss(positionId, 49000);
    const takeProfitTriggered = riskManager.checkTakeProfit(positionId, 52000);
    console.log('Stop Loss Triggered:', stopLossTriggered);
    console.log('Take Profit Triggered:', takeProfitTriggered);

    // Test drawdown management
    riskManager.updateAccountBalance(95000); // Simulate loss
    console.log('Can Open New Position:', riskManager.canOpenNewPosition());

    // Test position removal
    riskManager.removePosition(positionId);
    console.log('Position Removed:', !riskManager.getPosition(positionId));

    // Test multiple positions
    const position2 = {
        entryPrice: 49000,
        size: 0.5,
        type: 'short' as const,
        stopLoss: 50000,
        takeProfit: 47000,
        trailingStop: 50000
    };

    riskManager.addPosition('test-position-2', position2);
    console.log('All Positions:', riskManager.getAllPositions());
}

// Run the test
testRiskManager().catch(console.error); 