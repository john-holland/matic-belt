export const paymentConfig = {
    square: {
        applicationId: process.env.SQUARE_APP_ID || '',
        locationId: process.env.SQUARE_LOCATION_ID || '',
        accessToken: process.env.SQUARE_ACCESS_TOKEN || '',
        environment: process.env.SQUARE_ENVIRONMENT || 'sandbox'
    },
    crypto: {
        ethereumRpcUrl: process.env.ETHEREUM_RPC_URL || 'https://mainnet.infura.io/v3/YOUR-PROJECT-ID',
        cursorAddress: process.env.CURSOR_ETH_ADDRESS || '0x...', // Cursor's Ethereum address
        minDonationAmount: 0.01, // Minimum donation amount in ETH
        creditRate: 100 // Credits per ETH
    },
    credits: {
        initialBalance: 100,
        minPurchaseAmount: 10,
        maxPurchaseAmount: 1000
    }
}; 