import { exec } from 'child_process';
import { promisify } from 'util';
import { BaseMemoryExaminer } from './base';
import { MemoryRegion, MemoryInfo, ProcessInfo } from '../types';

const execAsync = promisify(exec);

export class MacMemoryExaminer extends BaseMemoryExaminer {
    private scanTimer?: NodeJS.Timeout;

    constructor() {
        super();
    }

    public async start(): Promise<void> {
        if (this.isRunning) {
            return;
        }

        this.isRunning = true;
        this.startPeriodicScan();
    }

    public async stop(): Promise<void> {
        if (!this.isRunning) {
            return;
        }

        this.isRunning = false;
        if (this.scanTimer) {
            clearInterval(this.scanTimer);
            this.scanTimer = undefined;
        }
    }

    public async getMemoryInfo(): Promise<MemoryInfo> {
        try {
            // Get system memory info using vm_stat and sysctl
            const [vmStat, sysctl] = await Promise.all([
                execAsync('vm_stat'),
                execAsync('sysctl hw.memsize')
            ]);

            // Parse vm_stat output
            const vmStats = this.parseVmStat(vmStat.stdout);
            const totalMemory = parseInt(sysctl.stdout.split(':')[1].trim());

            // Calculate memory usage
            const used = totalMemory - (vmStats.free * 4096); // 4096 is page size
            const free = vmStats.free * 4096;

            // Get process list
            const processes = await this.getProcessList();

            // Get memory regions for all processes
            const regions: MemoryRegion[] = [];
            for (const process of processes) {
                const processRegions = await this.getProcessMemoryRegions(process.id);
                regions.push(...processRegions);
            }

            return this.createMemoryInfo(totalMemory, used, free, processes, regions);
        } catch (error) {
            this.emit('error', error as Error);
            throw error;
        }
    }

    public async getMemoryRegions(): Promise<MemoryRegion[]> {
        const memoryInfo = await this.getMemoryInfo();
        return memoryInfo.regions;
    }

    public async getProcessMemoryInfo(pid: number): Promise<MemoryInfo> {
        try {
            // Get process memory info using vmmap
            const { stdout } = await execAsync(`vmmap -interleaved ${pid}`);
            
            // Parse vmmap output
            const regions = this.parseVmmapOutput(stdout, pid);
            
            // Calculate process memory usage
            const total = regions.reduce((sum, region) => sum + region.size, 0);
            const used = total; // On Mac, we don't have a direct way to get used memory per process
            const free = 0;

            return this.createMemoryInfo(total, used, free, [{
                id: pid,
                name: await this.getProcessName(pid),
                memoryUsage: total,
                regions
            }], regions);
        } catch (error) {
            this.emit('error', error as Error);
            throw error;
        }
    }

    public async getProcessMemoryRegions(pid: number): Promise<MemoryRegion[]> {
        try {
            const { stdout } = await execAsync(`vmmap -interleaved ${pid}`);
            return this.parseVmmapOutput(stdout, pid);
        } catch (error) {
            this.emit('error', error as Error);
            throw error;
        }
    }

    private async getProcessList(): Promise<ProcessInfo[]> {
        try {
            const { stdout } = await execAsync('ps -A -o pid,comm,rss');
            const lines = stdout.split('\n').slice(1); // Skip header

            const processes: ProcessInfo[] = [];
            for (const line of lines) {
                const [pid, name, rss] = line.trim().split(/\s+/);
                if (pid && name && rss) {
                    processes.push({
                        id: parseInt(pid),
                        name,
                        memoryUsage: parseInt(rss) * 1024, // Convert KB to bytes
                        regions: []
                    });
                }
            }

            return processes;
        } catch (error) {
            this.emit('error', error as Error);
            throw error;
        }
    }

    private async getProcessName(pid: number): Promise<string> {
        try {
            const { stdout } = await execAsync(`ps -p ${pid} -o comm=`);
            return stdout.trim();
        } catch (error) {
            return 'unknown';
        }
    }

    private parseVmStat(output: string): { free: number } {
        const lines = output.split('\n');
        let free = 0;

        for (const line of lines) {
            if (line.includes('Pages free')) {
                const match = line.match(/(\d+)/);
                if (match) {
                    free = parseInt(match[1]);
                }
            }
        }

        return { free };
    }

    private parseVmmapOutput(output: string, pid: number): MemoryRegion[] {
        const regions: MemoryRegion[] = [];
        const lines = output.split('\n');
        let totalMemory = 0;

        // First pass to get total memory
        for (const line of lines) {
            if (line.includes('TOTAL')) {
                const match = line.match(/(\d+[KMG]B)/);
                if (match) {
                    totalMemory = this.parseMemorySize(match[1]);
                }
            }
        }

        // Second pass to parse regions
        for (const line of lines) {
            if (line.match(/^[0-9a-f]{16}/)) {
                const parts = line.trim().split(/\s+/);
                if (parts.length >= 4) {
                    const address = parseInt(parts[0], 16);
                    const size = this.parseMemorySize(parts[1]);
                    const type = this.determineRegionType(parts[2]);
                    
                    regions.push(this.createMemoryRegion(
                        address,
                        size,
                        type,
                        pid,
                        totalMemory,
                        {
                            permissions: parts[3],
                            accessCount: 0,
                            lastAccess: Date.now()
                        }
                    ));
                }
            }
        }

        return regions;
    }

    private parseMemorySize(sizeStr: string): number {
        const match = sizeStr.match(/(\d+)([KMG]B)/);
        if (!match) return 0;

        const [, size, unit] = match;
        const multiplier = {
            'KB': 1024,
            'MB': 1024 * 1024,
            'GB': 1024 * 1024 * 1024
        }[unit as keyof typeof multiplier] || 1;

        return parseInt(size) * multiplier;
    }

    private determineRegionType(typeStr: string): 'code' | 'data' | 'heap' | 'stack' | 'unknown' {
        const typeMap: { [key: string]: 'code' | 'data' | 'heap' | 'stack' | 'unknown' } = {
            '__TEXT': 'code',
            '__DATA': 'data',
            'MALLOC': 'heap',
            'Stack': 'stack'
        };

        for (const [key, value] of Object.entries(typeMap)) {
            if (typeStr.includes(key)) {
                return value;
            }
        }

        return 'unknown';
    }

    private startPeriodicScan(): void {
        this.scanTimer = setInterval(async () => {
            try {
                const memoryInfo = await this.getMemoryInfo();
                this.emit('memoryUpdate', memoryInfo);
            } catch (error) {
                this.emit('error', error as Error);
            }
        }, this.scanInterval);
    }
} 