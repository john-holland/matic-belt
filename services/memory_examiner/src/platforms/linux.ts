import { exec } from 'child_process';
import { promisify } from 'util';
import { BaseMemoryExaminer } from './base';
import { MemoryRegion, MemoryInfo, ProcessInfo } from '../types';

const execAsync = promisify(exec);

export class LinuxMemoryExaminer extends BaseMemoryExaminer {
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
            // Get system memory info from /proc/meminfo
            const { stdout: meminfo } = await execAsync('cat /proc/meminfo');
            
            // Parse meminfo
            const memoryStats = this.parseMemInfo(meminfo);
            const totalMemory = memoryStats.MemTotal;
            const used = totalMemory - memoryStats.MemFree - memoryStats.Cached - memoryStats.Buffers;
            const free = memoryStats.MemFree;

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
            // Get process memory info from /proc/[pid]/status and /proc/[pid]/maps
            const [status, maps] = await Promise.all([
                execAsync(`cat /proc/${pid}/status`),
                execAsync(`cat /proc/${pid}/maps`)
            ]);

            // Parse process status
            const processStats = this.parseProcessStatus(status.stdout);
            
            // Parse memory maps
            const regions = this.parseMemoryMaps(maps.stdout, pid, processStats.VmSize);

            return this.createMemoryInfo(
                processStats.VmSize,
                processStats.VmRSS,
                processStats.VmSize - processStats.VmRSS,
                [{
                    id: pid,
                    name: await this.getProcessName(pid),
                    memoryUsage: processStats.VmRSS,
                    regions
                }],
                regions
            );
        } catch (error) {
            this.emit('error', error as Error);
            throw error;
        }
    }

    public async getProcessMemoryRegions(pid: number): Promise<MemoryRegion[]> {
        try {
            const { stdout: status } = await execAsync(`cat /proc/${pid}/status`);
            const { stdout: maps } = await execAsync(`cat /proc/${pid}/maps`);
            
            const processStats = this.parseProcessStatus(status);
            return this.parseMemoryMaps(maps, pid, processStats.VmSize);
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

    private parseMemInfo(output: string): { [key: string]: number } {
        const stats: { [key: string]: number } = {};
        const lines = output.split('\n');

        for (const line of lines) {
            const [key, value] = line.split(':');
            if (key && value) {
                const numValue = parseInt(value.trim().split(' ')[0]);
                if (!isNaN(numValue)) {
                    stats[key.trim()] = numValue * 1024; // Convert KB to bytes
                }
            }
        }

        return stats;
    }

    private parseProcessStatus(output: string): { [key: string]: number } {
        const stats: { [key: string]: number } = {};
        const lines = output.split('\n');

        for (const line of lines) {
            const [key, value] = line.split(':');
            if (key && value) {
                const numValue = parseInt(value.trim().split(' ')[0]);
                if (!isNaN(numValue)) {
                    stats[key.trim()] = numValue * 1024; // Convert KB to bytes
                }
            }
        }

        return stats;
    }

    private parseMemoryMaps(output: string, pid: number, totalMemory: number): MemoryRegion[] {
        const regions: MemoryRegion[] = [];
        const lines = output.split('\n');

        for (const line of lines) {
            const parts = line.trim().split(/\s+/);
            if (parts.length >= 5) {
                const [addressRange, permissions, offset, dev, inode, ...rest] = parts;
                const [start, end] = addressRange.split('-').map(addr => parseInt(addr, 16));
                const size = end - start;
                const type = this.determineRegionType(permissions, rest.join(' '));

                regions.push(this.createMemoryRegion(
                    start,
                    size,
                    type,
                    pid,
                    totalMemory,
                    {
                        permissions,
                        offset: parseInt(offset, 16),
                        device: dev,
                        inode: parseInt(inode),
                        accessCount: 0,
                        lastAccess: Date.now()
                    }
                ));
            }
        }

        return regions;
    }

    private determineRegionType(permissions: string, path: string): MemoryRegion['type'] {
        if (path.includes('[stack]')) return 'stack';
        if (path.includes('[heap]')) return 'heap';
        if (permissions.includes('x')) return 'code';
        if (permissions.includes('w')) return 'data';
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