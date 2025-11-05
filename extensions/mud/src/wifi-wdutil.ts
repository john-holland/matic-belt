import { execSync } from 'child_process';

export interface WiFiSignal {
    ssid: string;
    bssid: string;
    channel: number;
    frequency: number;
    signal_level: number;
    quality: number;
    security: string;
    timestamp: number;
}

export class WiFiManagerWDUtil {
    private signals: Map<string, WiFiSignal>;
    private isScanning: boolean;
    private scanInterval: NodeJS.Timeout | null;
    private useSudo: boolean;

    constructor(useSudo: boolean = false) {
        this.signals = new Map();
        this.isScanning = false;
        this.scanInterval = null;
        this.useSudo = useSudo;
    }

    public async initialize(): Promise<void> {
        try {
            // Test if wdutil is available
            if (process.platform !== 'darwin') {
                throw new Error('wdutil is only available on macOS');
            }

            // Test wdutil access
            try {
                const testCommand = this.useSudo ? 'sudo wdutil info' : 'wdutil info';
                execSync(testCommand, { 
                    encoding: 'utf8',
                    timeout: 2000,
                    stdio: 'pipe'
                });
                console.log(`✅ wdutil initialized${this.useSudo ? ' (with sudo)' : ''}`);
            } catch (error: any) {
                if (error.message.includes('sudo') || error.message.includes('password')) {
                    console.warn('⚠️ wdutil requires sudo. Set useSudo=true or run server with sudo');
                    this.useSudo = true;
                } else {
                    throw error;
                }
            }
        } catch (error: any) {
            console.error('Failed to initialize wdutil:', error.message);
            throw error;
        }
    }

    public startScanning(interval: number = 5000): void {
        if (this.isScanning) return;

        this.isScanning = true;
        this.scanInterval = setInterval(async () => {
            try {
                const networks = await this.scan();
                this.updateSignals(networks);
            } catch (error) {
                console.error('Failed to scan WiFi networks:', error);
            }
        }, interval);
    }

    public stopScanning(): void {
        if (this.scanInterval) {
            clearInterval(this.scanInterval);
            this.scanInterval = null;
        }
        this.isScanning = false;
    }

    public async scan(): Promise<WiFiSignal[]> {
        try {
            const command = this.useSudo ? 'sudo wdutil info' : 'wdutil info';
            const output = execSync(command, {
                encoding: 'utf8',
                timeout: 5000,
                stdio: 'pipe'
            });

            return this.parseWDUtilOutput(output);
        } catch (error: any) {
            // If sudo is required but not used, try with sudo
            if (!this.useSudo && (error.message.includes('sudo') || error.message.includes('password'))) {
                console.log('⚠️ Retrying with sudo...');
                this.useSudo = true;
                return this.scan();
            }
            throw error;
        }
    }

    private parseWDUtilOutput(output: string): WiFiSignal[] {
        const networks: WiFiSignal[] = [];
        const now = Date.now();
        const lines = output.split('\n');

        // Parse wdutil info output
        // Format varies, but typically includes:
        // - SSID: network name
        // - RSSI: signal strength
        // - Channel: channel number
        // - Security: security type

        let currentNetwork: Partial<WiFiSignal> = {};
        
        lines.forEach(line => {
            const trimmed = line.trim();
            
            // SSID
            if (trimmed.includes('SSID:') || trimmed.startsWith('SSID')) {
                const ssid = trimmed.split(/SSID:?\s*/i)[1]?.trim();
                if (ssid && ssid.length > 0) {
                    currentNetwork.ssid = ssid;
                }
            }
            
            // RSSI (signal strength in dBm)
            if (trimmed.includes('RSSI:') || trimmed.includes('Signal:')) {
                const match = trimmed.match(/RSSI:?\s*(-?\d+)|Signal:?\s*(-?\d+)/i);
                if (match) {
                    const rssi = parseInt(match[1] || match[2] || '-70');
                    currentNetwork.signal_level = rssi;
                    currentNetwork.quality = Math.max(0, Math.min(100, (rssi + 100) / 0.5));
                }
            }
            
            // Channel
            if (trimmed.includes('Channel:') || trimmed.includes('CH:')) {
                const match = trimmed.match(/Channel:?\s*(\d+)|CH:?\s*(\d+)/i);
                if (match) {
                    currentNetwork.channel = parseInt(match[1] || match[2] || '0');
                }
            }
            
            // Frequency (can be calculated from channel)
            if (currentNetwork.channel && !currentNetwork.frequency) {
                // 2.4 GHz: channels 1-14, 5 GHz: channels 36+
                if (currentNetwork.channel <= 14) {
                    currentNetwork.frequency = 2400 + (currentNetwork.channel * 5);
                } else {
                    currentNetwork.frequency = 5000 + (currentNetwork.channel * 5);
                }
            }
            
            // Security
            if (trimmed.includes('Security:') || trimmed.includes('Auth:')) {
                const security = trimmed.split(/Security:?\s*|Auth:?\s*/i)[1]?.trim() || 'unknown';
                currentNetwork.security = security;
            }
            
            // When we have a complete network, add it
            if (currentNetwork.ssid && currentNetwork.signal_level !== undefined) {
                networks.push({
                    ssid: currentNetwork.ssid,
                    bssid: currentNetwork.bssid || 'unknown',
                    channel: currentNetwork.channel || 0,
                    frequency: currentNetwork.frequency || 0,
                    signal_level: currentNetwork.signal_level,
                    quality: currentNetwork.quality || 50,
                    security: currentNetwork.security || 'unknown',
                    timestamp: now
                });
                
                currentNetwork = {};
            }
        });

        // If we only got partial info (like just current network), still add it
        if (currentNetwork.ssid) {
            networks.push({
                ssid: currentNetwork.ssid,
                bssid: 'unknown',
                channel: currentNetwork.channel || 0,
                frequency: currentNetwork.frequency || 0,
                signal_level: currentNetwork.signal_level || -70,
                quality: currentNetwork.quality || 50,
                security: currentNetwork.security || 'unknown',
                timestamp: now
            });
        }

        // Also try to get all visible networks using airport (deprecated but still works)
        try {
            const airportNetworks = this.scanWithAirport();
            if (airportNetworks.length > 0) {
                // Merge with wdutil results
                airportNetworks.forEach(net => {
                    if (!networks.find(n => n.ssid === net.ssid)) {
                        networks.push(net);
                    }
                });
            }
        } catch (error) {
            // Ignore airport errors
        }

        return networks;
    }

    private scanWithAirport(): WiFiSignal[] {
        try {
            const airportPath = '/System/Library/PrivateFrameworks/Apple80211.framework/Versions/Current/Resources/airport';
            const output = execSync(`${airportPath} -s`, {
                encoding: 'utf8',
                timeout: 3000,
                stdio: 'pipe'
            });

            const networks: WiFiSignal[] = [];
            const now = Date.now();
            const lines = output.split('\n').slice(1); // Skip header

            lines.forEach(line => {
                if (!line.trim()) return;

                // Parse airport -s output format:
                // SSID BSSID             RSSI CHANNEL HT CC SECURITY
                const parts = line.trim().split(/\s+/);
                if (parts.length >= 6) {
                    const ssid = parts[0];
                    const bssid = parts[1];
                    const rssi = parseInt(parts[2]) || -70;
                    const channel = parseInt(parts[3]) || 0;
                    const security = parts.slice(5).join(' ') || 'none';

                    networks.push({
                        ssid,
                        bssid,
                        channel,
                        frequency: channel <= 14 ? 2400 + (channel * 5) : 5000 + (channel * 5),
                        signal_level: rssi,
                        quality: Math.max(0, Math.min(100, (rssi + 100) / 0.5)),
                        security,
                        timestamp: now
                    });
                }
            });

            return networks;
        } catch (error) {
            return [];
        }
    }

    private updateSignals(networks: WiFiSignal[]): void {
        const now = Date.now();
        
        networks.forEach(network => {
            this.signals.set(network.ssid, network);
        });

        // Remove old signals (older than 30 seconds)
        const thirtySecondsAgo = now - 30000;
        for (const [ssid, signal] of this.signals.entries()) {
            if (signal.timestamp < thirtySecondsAgo) {
                this.signals.delete(ssid);
            }
        }
    }

    public getSignals(): Map<string, WiFiSignal> {
        return this.signals;
    }

    public getSignalStrength(ssid: string): number | null {
        const signal = this.signals.get(ssid);
        return signal ? signal.signal_level : null;
    }

    public getSignalQuality(ssid: string): number | null {
        const signal = this.signals.get(ssid);
        return signal ? signal.quality : null;
    }
}

