import { exec } from 'child_process';
import { promisify } from 'util';
import { BaseMemoryExaminer } from './base';
import { MemoryRegion, MemoryInfo, ProcessInfo } from '../types';

const execAsync = promisify(exec);

export class WindowsMemoryExaminer extends BaseMemoryExaminer {
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
            // Get system memory info using wmic
            const { stdout: memoryInfo } = await execAsync('wmic OS get TotalVisibleMemorySize,FreePhysicalMemory /Value');
            
            // Parse memory info
            const memoryStats = this.parseMemoryInfo(memoryInfo);
            const totalMemory = memoryStats.TotalVisibleMemorySize * 1024; // Convert KB to bytes
            const free = memoryStats.FreePhysicalMemory * 1024;
            const used = totalMemory - free;

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
            // Get process memory info using wmic
            const { stdout: processInfo } = await execAsync(`wmic process where ProcessId=${pid} get WorkingSetSize,PrivatePageCount /Value`);
            
            // Parse process info
            const processStats = this.parseProcessInfo(processInfo);
            const total = processStats.PrivatePageCount;
            const used = processStats.WorkingSetSize;
            const free = total - used;

            // Get memory regions using handle.exe (requires handle.exe to be installed)
            const regions = await this.getProcessMemoryRegions(pid);

            return this.createMemoryInfo(
                total,
                used,
                free,
                [{
                    id: pid,
                    name: await this.getProcessName(pid),
                    memoryUsage: used,
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
            // Use handle.exe to get memory regions (requires handle.exe to be installed)
            const { stdout } = await execAsync(`handle.exe -p ${pid}`);
            return this.parseHandleOutput(stdout, pid);
        } catch (error) {
            // Fallback to basic memory info if handle.exe is not available
            const { stdout } = await execAsync(`wmic process where ProcessId=${pid} get WorkingSetSize,PrivatePageCount /Value`);
            const processStats = this.parseProcessInfo(stdout);
            
            return [this.createMemoryRegion(
                0,
                processStats.WorkingSetSize,
                'unknown',
                pid,
                processStats.PrivatePageCount,
                {
                    accessCount: 0,
                    lastAccess: Date.now()
                }
            )];
        }
    }

    private async getProcessList(): Promise<ProcessInfo[]> {
        try {
            const { stdout } = await execAsync('wmic process get ProcessId,Name,WorkingSetSize /Format:CSV');
            const lines = stdout.split('\n').slice(1); // Skip header

            const processes: ProcessInfo[] = [];
            for (const line of lines) {
                const [pid, name, memory] = line.split(',').map(s => s.trim());
                if (pid && name && memory) {
                    processes.push({
                        id: parseInt(pid),
                        name,
                        memoryUsage: parseInt(memory),
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
            const { stdout } = await execAsync(`wmic process where ProcessId=${pid} get Name /Value`);
            const match = stdout.match(/Name=([^\r\n]+)/);
            return match ? match[1] : 'unknown';
        } catch (error) {
            return 'unknown';
        }
    }

    private parseMemoryInfo(output: string): { [key: string]: number } {
        const stats: { [key: string]: number } = {};
        const lines = output.split('\n');

        for (const line of lines) {
            const [key, value] = line.split('=');
            if (key && value) {
                const numValue = parseInt(value.trim());
                if (!isNaN(numValue)) {
                    stats[key.trim()] = numValue;
                }
            }
        }

        return stats;
    }

    private parseProcessInfo(output: string): { [key: string]: number } {
        const stats: { [key: string]: number } = {};
        const lines = output.split('\n');

        for (const line of lines) {
            const [key, value] = line.split('=');
            if (key && value) {
                const numValue = parseInt(value.trim());
                if (!isNaN(numValue)) {
                    stats[key.trim()] = numValue;
                }
            }
        }

        return stats;
    }

    private parseHandleOutput(output: string, pid: number): MemoryRegion[] {
        const regions: MemoryRegion[] = [];
        const lines = output.split('\n');
        let currentAddress = 0;
        let currentSize = 0;
        let currentType: MemoryRegion['type'] = 'unknown';

        for (const line of lines) {
            if (line.includes('Type:')) {
                // Save previous region if exists
                if (currentSize > 0) {
                    regions.push(this.createMemoryRegion(
                        currentAddress,
                        currentSize,
                        currentType,
                        pid,
                        0, // Will be updated later
                        {
                            accessCount: 0,
                            lastAccess: Date.now()
                        }
                    ));
                }

                // Parse new region
                const typeMatch = line.match(/Type:\s*(\w+)/);
                if (typeMatch) {
                    currentType = this.determineRegionType(typeMatch[1]);
                }

                const addrMatch = line.match(/Address:\s*([0-9A-F]+)/i);
                if (addrMatch) {
                    currentAddress = parseInt(addrMatch[1], 16);
                }

                const sizeMatch = line.match(/Size:\s*(\d+)/);
                if (sizeMatch) {
                    currentSize = parseInt(sizeMatch[1]);
                }
            }
        }

        // Add last region
        if (currentSize > 0) {
            regions.push(this.createMemoryRegion(
                currentAddress,
                currentSize,
                currentType,
                pid,
                0, // Will be updated later
                {
                    accessCount: 0,
                    lastAccess: Date.now()
                }
            ));
        }

        return regions;
    }

    private determineRegionType(typeStr: string): MemoryRegion['type'] {
        const typeMap: { [key: string]: MemoryRegion['type'] } = {
            'Section': 'data',
            'File': 'code',
            'Heap': 'heap',
            'Thread': 'stack'
        };

        return typeMap[typeStr] || 'unknown';
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