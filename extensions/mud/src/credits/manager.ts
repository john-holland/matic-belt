import { Square } from 'square';
import { Web3 } from 'web3';
import { config } from '../config';

export interface CreditTransaction {
    id: string;
    userId: string;
    amount: number;
    type: 'purchase' | 'usage' | 'donation';
    timestamp: number;
    paymentMethod: 'square' | 'crypto' | 'system';
    status: 'pending' | 'completed' | 'failed';
    metadata?: Record<string, any>;
}

export class CreditManager {
    private square: Square;
    private web3: Web3;
    private transactions: Map<string, CreditTransaction> = new Map();
    private userCredits: Map<string, number> = new Map();

    constructor() {
        // Initialize Square client
        this.square = new Square({
            accessToken: config.SQUARE_ACCESS_TOKEN,
            environment: config.SQUARE_ENVIRONMENT
        });

        // Initialize Web3
        this.web3 = new Web3(config.ETHEREUM_RPC_URL);
    }

    public async initializeUser(userId: string): Promise<void> {
        if (!this.userCredits.has(userId)) {
            this.userCredits.set(userId, 100); // Initial 100 credits
        }
    }

    public async purchaseCredits(
        userId: string,
        amount: number,
        paymentMethod: 'square' | 'crypto',
        paymentDetails: any
    ): Promise<CreditTransaction> {
        const transaction: CreditTransaction = {
            id: this.generateTransactionId(),
            userId,
            amount,
            type: 'purchase',
            timestamp: Date.now(),
            paymentMethod,
            status: 'pending',
            metadata: paymentDetails
        };

        try {
            if (paymentMethod === 'square') {
                await this.processSquarePayment(transaction);
            } else {
                await this.processCryptoPayment(transaction);
            }

            transaction.status = 'completed';
            this.addCredits(userId, amount);
        } catch (error) {
            transaction.status = 'failed';
            throw error;
        }

        this.transactions.set(transaction.id, transaction);
        return transaction;
    }

    public async donateCredits(
        fromUserId: string,
        toUserId: string,
        amount: number,
        paymentMethod: 'square' | 'crypto',
        paymentDetails: any
    ): Promise<CreditTransaction> {
        if (this.getCredits(fromUserId) < amount) {
            throw new Error('Insufficient credits for donation');
        }

        const transaction: CreditTransaction = {
            id: this.generateTransactionId(),
            userId: fromUserId,
            amount,
            type: 'donation',
            timestamp: Date.now(),
            paymentMethod,
            status: 'pending',
            metadata: {
                ...paymentDetails,
                recipient: toUserId
            }
        };

        try {
            if (paymentMethod === 'square') {
                await this.processSquarePayment(transaction);
            } else {
                await this.processCryptoPayment(transaction);
            }

            transaction.status = 'completed';
            this.deductCredits(fromUserId, amount);
            this.addCredits(toUserId, amount);
        } catch (error) {
            transaction.status = 'failed';
            throw error;
        }

        this.transactions.set(transaction.id, transaction);
        return transaction;
    }

    public async useCredits(userId: string, amount: number): Promise<void> {
        if (this.getCredits(userId) < amount) {
            throw new Error('Insufficient credits');
        }

        const transaction: CreditTransaction = {
            id: this.generateTransactionId(),
            userId,
            amount,
            type: 'usage',
            timestamp: Date.now(),
            paymentMethod: 'system',
            status: 'completed'
        };

        this.deductCredits(userId, amount);
        this.transactions.set(transaction.id, transaction);
    }

    private async processSquarePayment(transaction: CreditTransaction): Promise<void> {
        const { amount, metadata } = transaction;
        const payment = await this.square.payments.createPayment({
            sourceId: metadata.sourceId,
            amountMoney: {
                amount: amount * 100, // Convert to cents
                currency: 'USD'
            },
            locationId: config.SQUARE_LOCATION_ID,
            note: `Credit purchase for user ${transaction.userId}`
        });

        transaction.metadata = {
            ...transaction.metadata,
            squarePaymentId: payment.id
        };
    }

    private async processCryptoPayment(transaction: CreditTransaction): Promise<void> {
        const { amount, metadata } = transaction;
        const { fromAddress, toAddress } = metadata;

        // Verify transaction on blockchain
        const receipt = await this.web3.eth.getTransactionReceipt(metadata.txHash);
        if (!receipt || !receipt.status) {
            throw new Error('Invalid crypto transaction');
        }

        transaction.metadata = {
            ...transaction.metadata,
            blockNumber: receipt.blockNumber,
            gasUsed: receipt.gasUsed
        };
    }

    private addCredits(userId: string, amount: number): void {
        const currentCredits = this.getCredits(userId);
        this.userCredits.set(userId, currentCredits + amount);
    }

    private deductCredits(userId: string, amount: number): void {
        const currentCredits = this.getCredits(userId);
        this.userCredits.set(userId, currentCredits - amount);
    }

    public getCredits(userId: string): number {
        return this.userCredits.get(userId) || 0;
    }

    public getTransaction(transactionId: string): CreditTransaction | undefined {
        return this.transactions.get(transactionId);
    }

    public getUserTransactions(userId: string): CreditTransaction[] {
        return Array.from(this.transactions.values())
            .filter(tx => tx.userId === userId);
    }

    private generateTransactionId(): string {
        return `tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
} 