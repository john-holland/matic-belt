import * as wifi from 'node-wifi';

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

export class WiFiManager {
    private signals: Map<string, WiFiSignal>;
    private isScanning: boolean;
    private scanInterval: NodeJS.Timeout | null;

    constructor() {
        this.signals = new Map();
        this.isScanning = false;
        this.scanInterval = null;
    }

    public async initialize(): Promise<void> {
        try {
            await wifi.init({
                iface: null // Use default interface
            });
        } catch (error) {
            console.error('Failed to initialize WiFi:', error);
            throw error;
        }
    }

    public startScanning(interval: number = 5000): void {
        if (this.isScanning) return;

        this.isScanning = true;
        this.scanInterval = setInterval(async () => {
            try {
                const networks = await wifi.scan();
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

    private updateSignals(networks: any[]): void {
        const now = Date.now();
        
        networks.forEach(network => {
            const signal: WiFiSignal = {
                ssid: network.ssid,
                bssid: network.bssid,
                channel: network.channel,
                frequency: network.frequency,
                signal_level: network.signal_level,
                quality: network.quality,
                security: network.security,
                timestamp: now
            };
            
            this.signals.set(network.ssid, signal);
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

    public getSignalDirection(ssid: string): { x: number; y: number; z: number } | null {
        const signal = this.signals.get(ssid);
        if (!signal) return null;

        // Calculate direction based on signal strength and quality
        // This is a simplified implementation
        const strength = signal.signal_level;
        const quality = signal.quality;
        
        // Normalize values
        const normalizedStrength = (strength + 100) / 100; // Convert from dBm to 0-1
        const normalizedQuality = quality / 100;
        
        // Calculate direction (simplified)
        return {
            x: Math.cos(normalizedStrength * Math.PI * 2),
            y: Math.sin(normalizedStrength * Math.PI * 2),
            z: normalizedQuality
        };
    }
} 