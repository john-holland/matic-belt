import { platform } from 'os';
import { EventEmitter } from 'events';
import { QuadTree } from './quadTree';
import { MemoryPattern } from './types';
import { PlatformAdapter } from './platforms/base';
import { MacAdapter } from './platforms/mac';
import { LinuxAdapter } from './platforms/linux';
import { WindowsAdapter } from './platforms/windows';
import { PatternRecognizer } from './patternRecognizer';
import { FileWatcher } from './fileWatcher';

export class MemoryExaminer extends EventEmitter {
    private platformAdapter: PlatformAdapter;
    private quadTree: QuadTree;
    private patternRecognizer: PatternRecognizer;
    private fileWatcher: FileWatcher;
    private isRunning: boolean = false;
    private scanInterval: NodeJS.Timeout | null = null;

    constructor() {
        super();
        this.platformAdapter = this.createPlatformAdapter();
        this.quadTree = new QuadTree();
        this.patternRecognizer = new PatternRecognizer();
        this.fileWatcher = new FileWatcher();
    }

    private createPlatformAdapter(): PlatformAdapter {
        const currentPlatform = platform();
        switch (currentPlatform) {
            case 'darwin':
                return new MacAdapter();
            case 'linux':
                return new LinuxAdapter();
            case 'win32':
                return new WindowsAdapter();
            default:
                throw new Error(`Unsupported platform: ${currentPlatform}`);
        }
    }

    public async start(): Promise<void> {
        if (this.isRunning) return;

        this.isRunning = true;
        await this.platformAdapter.initialize();
        await this.fileWatcher.start();

        // Start periodic memory scanning
        this.scanInterval = setInterval(async () => {
            try {
                await this.performMemoryScan();
            } catch (error) {
                this.emit('error', error);
            }
        }, 1000); // Scan every second

        this.emit('started');
    }

    public async stop(): Promise<void> {
        if (!this.isRunning) return;

        this.isRunning = false;
        if (this.scanInterval) {
            clearInterval(this.scanInterval);
            this.scanInterval = null;
        }

        await this.platformAdapter.cleanup();
        await this.fileWatcher.stop();
        this.emit('stopped');
    }

    private async performMemoryScan(): Promise<void> {
        // Get memory information from platform adapter
        const memoryInfo = await this.platformAdapter.getMemoryInfo();
        
        // Update quad tree with new memory data
        this.quadTree.update(memoryInfo);

        // Analyze patterns
        const patterns = await this.patternRecognizer.analyze(memoryInfo);
        
        // Check for anomalies
        const anomalies = this.patternRecognizer.detectAnomalies(patterns);

        // Get file system changes
        const fileChanges = this.fileWatcher.getRecentChanges();

        // Emit analysis results
        this.emit('analysis', {
            timestamp: Date.now(),
            memoryInfo,
            patterns,
            anomalies,
            fileChanges,
            quadTreeState: this.quadTree.getState()
        });
    }

    public getQuadTreeState(): any {
        return this.quadTree.getState();
    }

    public getPatterns(): MemoryPattern[] {
        return this.patternRecognizer.getPatterns();
    }

    public getAnomalies(): any[] {
        return this.patternRecognizer.getAnomalies();
    }

    public getFileChanges(): any[] {
        return this.fileWatcher.getRecentChanges();
    }
} 