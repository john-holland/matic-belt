import { MemoryRegion, MemoryInfo, ProcessInfo } from '../types';
import { EventEmitter } from 'eventemitter3';

export interface MemoryExaminerEvents {
    'memoryUpdate': (info: MemoryInfo) => void;
    'patternDetected': (pattern: any) => void;
    'anomalyDetected': (anomaly: any) => void;
    'analysis': (result: any) => void;
    'error': (error: Error) => void;
}

export abstract class BaseMemoryExaminer extends EventEmitter<MemoryExaminerEvents> {
    protected isRunning: boolean = false;
    protected scanInterval: number = 1000; // Default scan interval in milliseconds

    constructor() {
        super();
    }

    public abstract start(): Promise<void>;
    public abstract stop(): Promise<void>;
    public abstract getMemoryInfo(): Promise<MemoryInfo>;
    public abstract getMemoryRegions(): Promise<MemoryRegion[]>;
    public abstract getProcessMemoryInfo(pid: number): Promise<MemoryInfo>;
    public abstract getProcessMemoryRegions(pid: number): Promise<MemoryRegion[]>;

    public setScanInterval(interval: number): void {
        this.scanInterval = interval;
    }

    public getScanInterval(): number {
        return this.scanInterval;
    }

    public isActive(): boolean {
        return this.isRunning;
    }

    protected normalizeAddress(address: number, totalMemory: number): number {
        return address / totalMemory;
    }

    protected normalizeSize(size: number, totalMemory: number): number {
        return size / totalMemory;
    }

    protected createMemoryRegion(
        address: number,
        size: number,
        type: MemoryRegion['type'],
        processId: number,
        totalMemory: number,
        metadata?: any
    ): MemoryRegion {
        return {
            address,
            size,
            type,
            processId,
            normalizedAddress: this.normalizeAddress(address, totalMemory),
            normalizedSize: this.normalizeSize(size, totalMemory),
            metadata
        };
    }

    protected createMemoryInfo(
        total: number,
        used: number,
        free: number,
        processes: ProcessInfo[],
        regions: MemoryRegion[]
    ): MemoryInfo {
        return {
            timestamp: Date.now(),
            total,
            used,
            free,
            processes,
            regions
        };
    }

    // Event emitter methods
    public on<T extends keyof MemoryExaminerEvents>(event: T, listener: MemoryExaminerEvents[T]): this {
        return super.on(event, listener);
    }

    public off<T extends keyof MemoryExaminerEvents>(event: T, listener: MemoryExaminerEvents[T]): this {
        return super.off(event, listener);
    }

    public emit<T extends keyof MemoryExaminerEvents>(event: T, ...args: Parameters<MemoryExaminerEvents[T]>): boolean {
        return super.emit(event, ...args);
    }
} 