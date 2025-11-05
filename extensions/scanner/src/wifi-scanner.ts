import { WiFiManager, WiFiSignal } from './wifi';

async function startWifiScanner() {
    console.log('📡 Starting WiFi Scanner...');
    console.log('================================\n');

    const wifiManager = new WiFiManager();

    try {
        // Initialize WiFi
        await wifiManager.initialize();
        console.log('✅ WiFi initialized successfully\n');

        // Start scanning every 5 seconds
        wifiManager.startScanning(5000);
        console.log('🔄 Scanning for WiFi networks every 5 seconds...\n');
        console.log('Press Ctrl+C to stop\n');

        // Display networks periodically
        setInterval(() => {
            const signals = wifiManager.getSignals();
            
            if (signals.size === 0) {
                console.log('📶 No networks detected yet...');
                return;
            }

            console.clear();
            console.log('📡 WiFi Scanner - Active Networks');
            console.log('================================\n');
            console.log(`Found ${signals.size} network(s):\n`);

            // Sort by signal strength (highest first)
            const sortedSignals = Array.from(signals.entries())
                .sort((a, b) => b[1].signal_level - a[1].signal_level);

            sortedSignals.forEach(([ssid, signal], index) => {
                const bars = getSignalBars(signal.signal_level);
                const security = signal.security || 'Open';
                const channel = signal.channel || 'N/A';
                
                console.log(`${index + 1}. ${ssid}`);
                console.log(`   Signal: ${bars} (${signal.signal_level} dBm)`);
                console.log(`   Quality: ${signal.quality}%`);
                console.log(`   Channel: ${channel}`);
                console.log(`   Security: ${security}`);
                console.log(`   BSSID: ${signal.bssid}`);
                console.log(`   Frequency: ${signal.frequency} MHz`);
                console.log('');
            });

            console.log('Last updated:', new Date().toLocaleTimeString());
            console.log('\nPress Ctrl+C to stop');
        }, 2000);

    } catch (error) {
        console.error('❌ Failed to start WiFi scanner:', error);
        process.exit(1);
    }

    // Handle graceful shutdown
    process.on('SIGINT', () => {
        console.log('\n\n🛑 Stopping WiFi scanner...');
        wifiManager.stopScanning();
        console.log('✅ WiFi scanner stopped');
        process.exit(0);
    });
}

function getSignalBars(signalLevel: number): string {
    // Convert dBm to bars (0-4 bars)
    // Typical WiFi signal ranges:
    // -50 dBm: Excellent (4 bars)
    // -60 dBm: Very Good (3 bars)
    // -70 dBm: Good (2 bars)
    // -80 dBm: Fair (1 bar)
    // Below -80: Poor (0 bars)
    
    if (signalLevel >= -50) return '████';
    if (signalLevel >= -60) return '███░';
    if (signalLevel >= -70) return '██░░';
    if (signalLevel >= -80) return '█░░░';
    return '░░░░';
}

// Start the scanner
if (require.main === module) {
    startWifiScanner().catch(error => {
        console.error('Fatal error:', error);
        process.exit(1);
    });
}

export { startWifiScanner };

