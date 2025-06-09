import axios from 'axios';
import crypto from 'crypto';

interface OrderConfig {
    exchange: string;
    symbol: string;
    apiKey: string;
    apiSecret: string;
}

interface Order {
    id: string;
    symbol: string;
    type: 'market' | 'limit';
    side: 'buy' | 'sell';
    price: number;
    quantity: number;
    status: 'new' | 'partially_filled' | 'filled' | 'canceled' | 'rejected';
    filledQuantity: number;
    timestamp: number;
}

export class OrderManager {
    private config: OrderConfig;
    private orders: Map<string, Order>;

    constructor(config: OrderConfig) {
        this.config = config;
        this.orders = new Map();
    }

    public async placeOrder(
        side: 'buy' | 'sell',
        type: 'market' | 'limit',
        quantity: number,
        price?: number
    ): Promise<Order> {
        try {
            const order = await this.createOrder(side, type, quantity, price);
            this.orders.set(order.id, order);
            return order;
        } catch (error) {
            console.error('Error placing order:', error);
            throw error;
        }
    }

    private async createOrder(
        side: 'buy' | 'sell',
        type: 'market' | 'limit',
        quantity: number,
        price?: number
    ): Promise<Order> {
        const timestamp = Date.now();
        const orderId = this.generateOrderId();

        const order: Order = {
            id: orderId,
            symbol: this.config.symbol,
            type,
            side,
            price: price || 0,
            quantity,
            status: 'new',
            filledQuantity: 0,
            timestamp
        };

        // Implement exchange-specific order creation
        switch (this.config.exchange.toLowerCase()) {
            case 'binance':
                return this.createBinanceOrder(order);
            case 'coinbase':
                return this.createCoinbaseOrder(order);
            default:
                throw new Error(`Unsupported exchange: ${this.config.exchange}`);
        }
    }

    private async createBinanceOrder(order: Order): Promise<Order> {
        const endpoint = 'https://api.binance.com/api/v3/order';
        const params = {
            symbol: order.symbol,
            side: order.side.toUpperCase(),
            type: order.type.toUpperCase(),
            quantity: order.quantity.toString(),
            timestamp: Date.now()
        };

        if (order.type === 'limit') {
            params['price'] = order.price.toString();
        }

        const signature = this.generateBinanceSignature(params);
        const headers = {
            'X-MBX-APIKEY': this.config.apiKey
        };

        try {
            const response = await axios.post(endpoint, {
                ...params,
                signature
            }, { headers });

            return {
                ...order,
                id: response.data.orderId,
                status: this.mapBinanceOrderStatus(response.data.status),
                filledQuantity: parseFloat(response.data.executedQty)
            };
        } catch (error) {
            console.error('Binance order creation error:', error);
            throw error;
        }
    }

    private async createCoinbaseOrder(order: Order): Promise<Order> {
        const endpoint = 'https://api.pro.coinbase.com/orders';
        const timestamp = Date.now() / 1000;
        const body = {
            product_id: order.symbol,
            side: order.side,
            type: order.type,
            size: order.quantity.toString()
        };

        if (order.type === 'limit') {
            body['price'] = order.price.toString();
        }

        const signature = this.generateCoinbaseSignature(
            'POST',
            '/orders',
            body,
            timestamp
        );

        const headers = {
            'CB-ACCESS-KEY': this.config.apiKey,
            'CB-ACCESS-SIGN': signature,
            'CB-ACCESS-TIMESTAMP': timestamp.toString(),
            'CB-ACCESS-PASSPHRASE': this.config.apiSecret
        };

        try {
            const response = await axios.post(endpoint, body, { headers });
            return {
                ...order,
                id: response.data.id,
                status: this.mapCoinbaseOrderStatus(response.data.status),
                filledQuantity: parseFloat(response.data.filled_size)
            };
        } catch (error) {
            console.error('Coinbase order creation error:', error);
            throw error;
        }
    }

    public async cancelOrder(orderId: string): Promise<boolean> {
        const order = this.orders.get(orderId);
        if (!order) {
            throw new Error(`Order not found: ${orderId}`);
        }

        try {
            switch (this.config.exchange.toLowerCase()) {
                case 'binance':
                    return await this.cancelBinanceOrder(orderId);
                case 'coinbase':
                    return await this.cancelCoinbaseOrder(orderId);
                default:
                    throw new Error(`Unsupported exchange: ${this.config.exchange}`);
            }
        } catch (error) {
            console.error('Error canceling order:', error);
            throw error;
        }
    }

    private async cancelBinanceOrder(orderId: string): Promise<boolean> {
        const endpoint = 'https://api.binance.com/api/v3/order';
        const params = {
            symbol: this.config.symbol,
            orderId,
            timestamp: Date.now()
        };

        const signature = this.generateBinanceSignature(params);
        const headers = {
            'X-MBX-APIKEY': this.config.apiKey
        };

        try {
            await axios.delete(endpoint, {
                params: { ...params, signature },
                headers
            });
            return true;
        } catch (error) {
            console.error('Binance order cancellation error:', error);
            return false;
        }
    }

    private async cancelCoinbaseOrder(orderId: string): Promise<boolean> {
        const endpoint = `https://api.pro.coinbase.com/orders/${orderId}`;
        const timestamp = Date.now() / 1000;
        const signature = this.generateCoinbaseSignature(
            'DELETE',
            `/orders/${orderId}`,
            '',
            timestamp
        );

        const headers = {
            'CB-ACCESS-KEY': this.config.apiKey,
            'CB-ACCESS-SIGN': signature,
            'CB-ACCESS-TIMESTAMP': timestamp.toString(),
            'CB-ACCESS-PASSPHRASE': this.config.apiSecret
        };

        try {
            await axios.delete(endpoint, { headers });
            return true;
        } catch (error) {
            console.error('Coinbase order cancellation error:', error);
            return false;
        }
    }

    public async getOrderStatus(orderId: string): Promise<Order> {
        const order = this.orders.get(orderId);
        if (!order) {
            throw new Error(`Order not found: ${orderId}`);
        }

        try {
            switch (this.config.exchange.toLowerCase()) {
                case 'binance':
                    return await this.getBinanceOrderStatus(orderId);
                case 'coinbase':
                    return await this.getCoinbaseOrderStatus(orderId);
                default:
                    throw new Error(`Unsupported exchange: ${this.config.exchange}`);
            }
        } catch (error) {
            console.error('Error getting order status:', error);
            throw error;
        }
    }

    private async getBinanceOrderStatus(orderId: string): Promise<Order> {
        const endpoint = 'https://api.binance.com/api/v3/order';
        const params = {
            symbol: this.config.symbol,
            orderId,
            timestamp: Date.now()
        };

        const signature = this.generateBinanceSignature(params);
        const headers = {
            'X-MBX-APIKEY': this.config.apiKey
        };

        try {
            const response = await axios.get(endpoint, {
                params: { ...params, signature },
                headers
            });

            const order = this.orders.get(orderId)!;
            return {
                ...order,
                status: this.mapBinanceOrderStatus(response.data.status),
                filledQuantity: parseFloat(response.data.executedQty)
            };
        } catch (error) {
            console.error('Binance order status error:', error);
            throw error;
        }
    }

    private async getCoinbaseOrderStatus(orderId: string): Promise<Order> {
        const endpoint = `https://api.pro.coinbase.com/orders/${orderId}`;
        const timestamp = Date.now() / 1000;
        const signature = this.generateCoinbaseSignature(
            'GET',
            `/orders/${orderId}`,
            '',
            timestamp
        );

        const headers = {
            'CB-ACCESS-KEY': this.config.apiKey,
            'CB-ACCESS-SIGN': signature,
            'CB-ACCESS-TIMESTAMP': timestamp.toString(),
            'CB-ACCESS-PASSPHRASE': this.config.apiSecret
        };

        try {
            const response = await axios.get(endpoint, { headers });
            const order = this.orders.get(orderId)!;
            return {
                ...order,
                status: this.mapCoinbaseOrderStatus(response.data.status),
                filledQuantity: parseFloat(response.data.filled_size)
            };
        } catch (error) {
            console.error('Coinbase order status error:', error);
            throw error;
        }
    }

    private generateOrderId(): string {
        return crypto.randomBytes(16).toString('hex');
    }

    private generateBinanceSignature(params: any): string {
        const queryString = Object.entries(params)
            .map(([key, value]) => `${key}=${value}`)
            .join('&');

        return crypto
            .createHmac('sha256', this.config.apiSecret)
            .update(queryString)
            .digest('hex');
    }

    private generateCoinbaseSignature(
        method: string,
        path: string,
        body: string | object,
        timestamp: number
    ): string {
        const message = `${timestamp}${method}${path}${typeof body === 'string' ? body : JSON.stringify(body)}`;
        return crypto
            .createHmac('sha256', this.config.apiSecret)
            .update(message)
            .digest('base64');
    }

    private mapBinanceOrderStatus(status: string): Order['status'] {
        switch (status) {
            case 'NEW': return 'new';
            case 'PARTIALLY_FILLED': return 'partially_filled';
            case 'FILLED': return 'filled';
            case 'CANCELED': return 'canceled';
            case 'REJECTED': return 'rejected';
            default: return 'new';
        }
    }

    private mapCoinbaseOrderStatus(status: string): Order['status'] {
        switch (status) {
            case 'open': return 'new';
            case 'pending': return 'new';
            case 'done': return 'filled';
            case 'canceled': return 'canceled';
            default: return 'new';
        }
    }

    public getOrder(orderId: string): Order | undefined {
        return this.orders.get(orderId);
    }

    public getAllOrders(): Order[] {
        return Array.from(this.orders.values());
    }
} 