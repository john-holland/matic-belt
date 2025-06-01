export type MemoryRegionType = 'code' | 'data' | 'heap' | 'stack' | 'unknown';

export interface MemoryRegion {
    address: number;
    size: number;
    type: MemoryRegionType;
    processId: number;
    processName?: string;
    normalizedAddress?: number;
    normalizedSize?: number;
    metadata?: {
        accessCount?: number;
        lastAccess?: number;
        permissions?: string;
        [key: string]: any;
    };
}

export interface ProcessInfo {
    id: number;
    name: string;
    memoryUsage: number;
    regions: MemoryRegion[];
}

export interface MemoryInfo {
    timestamp: number;
    total: number;
    used: number;
    free: number;
    processes: ProcessInfo[];
    regions: MemoryRegion[];
}

export interface MemoryPattern {
    type: 'sequential' | 'random' | 'cyclic' | 'unknown';
    confidence: number;
    regions: MemoryRegion[];
    metadata?: {
        period?: number;
        entropy?: number;
        correlation?: number;
        [key: string]: any;
    };
}

export interface Anomaly {
    type: 'unusual_access' | 'memory_leak' | 'corruption' | 'unknown';
    severity: 'low' | 'medium' | 'high' | 'critical';
    description: string;
    affectedRegions: MemoryRegion[];
    timestamp: number;
    confidence: number;
    metadata?: {
        [key: string]: any;
    };
}

export interface FileChange {
    path: string;
    type: 'create' | 'modify' | 'delete';
    timestamp: number;
    processId?: number;
    metadata?: {
        size?: number;
        permissions?: string;
        [key: string]: any;
    };
}

export interface AnalysisResult {
    timestamp: number;
    memoryInfo: MemoryInfo;
    patterns: MemoryPattern[];
    anomalies: Anomaly[];
    fileChanges: FileChange[];
    quadTreeState: any; // Will be defined when implementing QuadTree
}

export interface GPSLocation {
    latitude: number;
    longitude: number;
    altitude?: number;
    accuracy?: number;
    timestamp: Date;
}

export interface SensorData {
    temperature?: number;
    humidity?: number;
    pressure?: number;
    light?: number;
    noise?: number;
    timestamp: Date;
    deviceId: string;
}

export interface ObjectDescription {
    top?: string;
    right?: string;
    left?: string;
    bottom?: string;
    front?: string;
    back?: string;
    metadata?: {
        color?: string;
        material?: string;
        size?: string;
        condition?: string;
    };
} 