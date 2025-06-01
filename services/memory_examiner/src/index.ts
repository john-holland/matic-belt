import { MemoryExaminerFactory } from './platforms/factory';
import { PatternRecognizer } from './patternRecognizer';
import { QuadTree } from './quadTree';
import { AnalysisResult } from './types';

export class MemoryExaminer {
    private examiner: ReturnType<typeof MemoryExaminerFactory.create>;
    private patternRecognizer: PatternRecognizer;
    private quadTree: QuadTree;
    private isRunning: boolean = false;

    constructor() {
        this.examiner = MemoryExaminerFactory.create();
        this.patternRecognizer = new PatternRecognizer();
        this.quadTree = new QuadTree();
    }

    public async start(): Promise<void> {
        if (this.isRunning) {
            return;
        }

        this.isRunning = true;
        await this.examiner.start();

        // Set up event handlers
        this.examiner.on('memoryUpdate', async (memoryInfo) => {
            try {
                // Update QuadTree with new memory regions
                this.quadTree.update(memoryInfo.regions);

                // Analyze patterns
                const patterns = await this.patternRecognizer.analyze(memoryInfo.regions);

                // Create analysis result
                const result: AnalysisResult = {
                    timestamp: Date.now(),
                    memoryInfo,
                    patterns,
                    anomalies: this.patternRecognizer.getAnomalies(),
                    fileChanges: [], // Will be implemented with file watcher
                    quadTreeState: this.quadTree.getState()
                };

                // Emit analysis result
                this.examiner.emit('analysis', result);
            } catch (error) {
                this.examiner.emit('error', error as Error);
            }
        });
    }

    public async stop(): Promise<void> {
        if (!this.isRunning) {
            return;
        }

        this.isRunning = false;
        await this.examiner.stop();
    }

    public async getMemoryInfo() {
        return this.examiner.getMemoryInfo();
    }

    public async getMemoryRegions() {
        return this.examiner.getMemoryRegions();
    }

    public async getProcessMemoryInfo(pid: number) {
        return this.examiner.getProcessMemoryInfo(pid);
    }

    public async getProcessMemoryRegions(pid: number) {
        return this.examiner.getProcessMemoryRegions(pid);
    }

    public setScanInterval(interval: number): void {
        this.examiner.setScanInterval(interval);
    }

    public getScanInterval(): number {
        return this.examiner.getScanInterval();
    }

    public isActive(): boolean {
        return this.isRunning;
    }

    public on(event: string, listener: (...args: any[]) => void): void {
        this.examiner.on(event, listener);
    }

    public off(event: string, listener: (...args: any[]) => void): void {
        this.examiner.off(event, listener);
    }
}

// Export types
export * from './types';

// Create and export a singleton instance
const memoryExaminer = new MemoryExaminer();
export default memoryExaminer; 