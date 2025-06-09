import { OrderManager } from './order-manager';

async function testOrders() {
    // Create order manager for BTC/USD on Binance
    const orderManager = new OrderManager({
        exchange: 'binance',
        symbol: 'BTCUSDT',
        apiKey: process.env.BINANCE_API_KEY || '',
        apiSecret: process.env.BINANCE_API_SECRET || ''
    });

    try {
        // Place a limit buy order
        console.log('Placing limit buy order...');
        const buyOrder = await orderManager.placeOrder(
            'buy',
            'limit',
            0.001, // 0.001 BTC
            50000  // $50,000
        );
        console.log('Buy order placed:', buyOrder);

        // Wait for 5 seconds
        await new Promise(resolve => setTimeout(resolve, 5000));

        // Check order status
        console.log('Checking order status...');
        const orderStatus = await orderManager.getOrderStatus(buyOrder.id);
        console.log('Order status:', orderStatus);

        // Cancel the order
        console.log('Canceling order...');
        const canceled = await orderManager.cancelOrder(buyOrder.id);
        console.log('Order canceled:', canceled);

        // Get all orders
        console.log('All orders:', orderManager.getAllOrders());
    } catch (error) {
        console.error('Error in order test:', error);
    }
}

// Run the test
testOrders().catch(console.error); 