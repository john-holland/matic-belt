import { MemoryRegion } from '../../types';

export class MemoryPatternGenerator {
    private baseAddress: number = 0x10000000;
    private currentAddress: number;
    private totalMemory: number;
    private pageSize: number = 4096;

    constructor(totalMemory: number = 1024 * 1024 * 1024) { // 1GB default
        this.totalMemory = totalMemory;
        this.currentAddress = this.baseAddress;
    }

    // Sequential pattern generator
    public generateSequential(count: number, size: number = this.pageSize): MemoryRegion[] {
        const regions: MemoryRegion[] = [];
        for (let i = 0; i < count; i++) {
            regions.push({
                address: this.currentAddress,
                size,
                type: i % 2 === 0 ? 'code' : 'data',
                processId: 1,
                metadata: {
                    accessCount: i,
                    lastAccess: Date.now()
                }
            });
            this.currentAddress += size;
        }
        return regions;
    }

    // Cyclic pattern generator
    public generateCyclic(count: number, cycleSize: number = 4): MemoryRegion[] {
        const regions: MemoryRegion[] = [];
        const types: MemoryRegion['type'][] = ['code', 'data', 'heap', 'stack'];
        
        for (let i = 0; i < count; i++) {
            const type = types[i % cycleSize];
            regions.push({
                address: this.currentAddress,
                size: this.pageSize,
                type,
                processId: 1,
                metadata: {
                    accessCount: i,
                    lastAccess: Date.now()
                }
            });
            this.currentAddress += this.pageSize;
        }
        return regions;
    }

    // Random pattern generator
    public generateRandom(count: number, maxSize: number = this.pageSize * 4): MemoryRegion[] {
        const regions: MemoryRegion[] = [];
        const types: MemoryRegion['type'][] = ['code', 'data', 'heap', 'stack'];
        
        for (let i = 0; i < count; i++) {
            const size = Math.floor(Math.random() * maxSize) + this.pageSize;
            const type = types[Math.floor(Math.random() * types.length)];
            
            regions.push({
                address: this.currentAddress,
                size,
                type,
                processId: 1,
                metadata: {
                    accessCount: Math.floor(Math.random() * 1000),
                    lastAccess: Date.now()
                }
            });
            this.currentAddress += size;
        }
        return regions;
    }

    // Growing pattern generator (with cap)
    public generateGrowing(
        count: number,
        growthFactor: number = 1.5,
        maxSize: number = this.pageSize * 16
    ): MemoryRegion[] {
        const regions: MemoryRegion[] = [];
        let currentSize = this.pageSize;
        
        for (let i = 0; i < count; i++) {
            regions.push({
                address: this.currentAddress,
                size: currentSize,
                type: 'heap',
                processId: 1,
                metadata: {
                    accessCount: i,
                    lastAccess: Date.now()
                }
            });
            
            this.currentAddress += currentSize;
            currentSize = Math.min(currentSize * growthFactor, maxSize);
        }
        return regions;
    }

    // Reset the generator
    public reset(): void {
        this.currentAddress = this.baseAddress;
    }
} 