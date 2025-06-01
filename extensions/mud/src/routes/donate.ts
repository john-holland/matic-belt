import { Router } from 'express';
import { CreditManager } from '../credits/manager';

const router = Router();
const creditManager = new CreditManager();

// Get user's credit balance
router.get('/credits', async (req, res) => {
    try {
        const userId = req.user.id; // Assuming user is authenticated
        await creditManager.initializeUser(userId);
        const balance = creditManager.getCredits(userId);
        res.json({ balance });
    } catch (error) {
        res.status(500).json({ error: 'Failed to get credit balance' });
    }
});

// Get user's transaction history
router.get('/transactions', async (req, res) => {
    try {
        const userId = req.user.id;
        const transactions = creditManager.getUserTransactions(userId);
        res.json(transactions);
    } catch (error) {
        res.status(500).json({ error: 'Failed to get transactions' });
    }
});

// Process Square payment
router.post('/square', async (req, res) => {
    try {
        const { nonce, amount } = req.body;
        const userId = req.user.id;

        const transaction = await creditManager.purchaseCredits(
            userId,
            amount,
            'square',
            { sourceId: nonce }
        );

        res.json(transaction);
    } catch (error) {
        res.status(500).json({ error: 'Payment failed' });
    }
});

// Process crypto payment
router.post('/crypto', async (req, res) => {
    try {
        const { txHash, amount } = req.body;
        const userId = req.user.id;

        const transaction = await creditManager.purchaseCredits(
            userId,
            amount,
            'crypto',
            { txHash }
        );

        res.json(transaction);
    } catch (error) {
        res.status(500).json({ error: 'Payment failed' });
    }
});

// Process donation
router.post('/donate', async (req, res) => {
    try {
        const { toUserId, amount, paymentMethod, paymentDetails } = req.body;
        const fromUserId = req.user.id;

        const transaction = await creditManager.donateCredits(
            fromUserId,
            toUserId,
            amount,
            paymentMethod,
            paymentDetails
        );

        res.json(transaction);
    } catch (error) {
        res.status(500).json({ error: 'Donation failed' });
    }
});

export default router; 