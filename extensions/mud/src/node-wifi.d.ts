declare module 'node-wifi' {
  export interface Network {
    ssid: string;
    bssid: string;
    mac: string;
    channel: number;
    frequency: number;
    signal_level: number;
    quality: number;
    security: string;
    security_flags: string[];
  }

  export interface WiFiInitOptions {
    iface?: string | null;
  }

  export function init(options: WiFiInitOptions): Promise<void>;
  export function scan(): Promise<Network[]>;
  export function getCurrentConnections(): Promise<Network[]>;
  export function connect(options: { ssid: string; password?: string }): Promise<void>;
  export function disconnect(): Promise<void>;
  export function deleteConnection(ssid: string): Promise<void>;
  export function getNetworks(): Promise<Network[]>;
}

