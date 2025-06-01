import { describe, beforeEach, afterEach, it, expect } from '@jest/globals';
import { MemoryPatternGenerator } from '../utils/memoryPatternGenerators';
import { PatternRecognizer } from '../../patternRecognizer';
import { QuadTree } from '../../quadTree';
import { MemoryExaminer } from '../../index';

describe('MemoryExaminer Performance Tests', () => {
    let generator: MemoryPatternGenerator;
    let patternRecognizer: PatternRecognizer;
    let quadTree: QuadTree;
    let memoryExaminer: MemoryExaminer;

    beforeEach(() => {
        generator = new MemoryPatternGenerator();
        patternRecognizer = new PatternRecognizer();
        quadTree = new QuadTree();
        memoryExaminer = new MemoryExaminer();
    });

    afterEach(async () => {
        await memoryExaminer.stop();
    });

    describe('Pattern Recognition Performance', () => {
        it('should handle sequential patterns efficiently', async () => {
            const regions = generator.generateSequential(1000);
            const startTime = process.hrtime();
            
            const patterns = await patternRecognizer.analyze(regions);
            
            const [seconds, nanoseconds] = process.hrtime(startTime);
            const duration = seconds * 1000 + nanoseconds / 1000000;
            
            expect(patterns.length).toBeGreaterThan(0);
            expect(duration).toBeLessThan(1000); // Should complete within 1 second
        });

        it('should handle cyclic patterns efficiently', async () => {
            const regions = generator.generateCyclic(1000);
            const startTime = process.hrtime();
            
            const patterns = await patternRecognizer.analyze(regions);
            
            const [seconds, nanoseconds] = process.hrtime(startTime);
            const duration = seconds * 1000 + nanoseconds / 1000000;
            
            expect(patterns.length).toBeGreaterThan(0);
            expect(duration).toBeLessThan(1000);
        });

        it('should handle random patterns efficiently', async () => {
            const regions = generator.generateRandom(1000);
            const startTime = process.hrtime();
            
            const patterns = await patternRecognizer.analyze(regions);
            
            const [seconds, nanoseconds] = process.hrtime(startTime);
            const duration = seconds * 1000 + nanoseconds / 1000000;
            
            expect(patterns.length).toBeGreaterThan(0);
            expect(duration).toBeLessThan(1000);
        });

        it('should handle growing patterns efficiently', async () => {
            const regions = generator.generateGrowing(1000);
            const startTime = process.hrtime();
            
            const patterns = await patternRecognizer.analyze(regions);
            
            const [seconds, nanoseconds] = process.hrtime(startTime);
            const duration = seconds * 1000 + nanoseconds / 1000000;
            
            expect(patterns.length).toBeGreaterThan(0);
            expect(duration).toBeLessThan(1000);
        });
    });

    describe('QuadTree Performance', () => {
        it('should handle large numbers of regions efficiently', () => {
            const regions = generator.generateRandom(10000);
            const startTime = process.hrtime();
            
            quadTree.update(regions);
            const state = quadTree.getState();
            
            const [seconds, nanoseconds] = process.hrtime(startTime);
            const duration = seconds * 1000 + nanoseconds / 1000000;
            
            expect(state.length).toBeGreaterThan(0);
            expect(duration).toBeLessThan(100); // Should complete within 100ms
        });

        it('should query regions efficiently', () => {
            const regions = generator.generateRandom(10000);
            quadTree.update(regions);
            
            const startTime = process.hrtime();
            
            const queryResult = quadTree.query({
                x: 0.2,
                y: 0.2,
                width: 0.6,
                height: 0.6
            });
            
            const [seconds, nanoseconds] = process.hrtime(startTime);
            const duration = seconds * 1000 + nanoseconds / 1000000;
            
            expect(queryResult.length).toBeGreaterThan(0);
            expect(duration).toBeLessThan(10); // Should complete within 10ms
        });
    });

    describe('End-to-End Performance', () => {
        it('should handle continuous memory updates efficiently', async () => {
            await memoryExaminer.start();
            
            const updateCount = 100;
            const updateTimes: number[] = [];
            
            for (let i = 0; i < updateCount; i++) {
                const regions = generator.generateRandom(1000);
                const startTime = process.hrtime();
                
                await new Promise<void>((resolve) => {
                    memoryExaminer.on('analysis', () => {
                        const [seconds, nanoseconds] = process.hrtime(startTime);
                        updateTimes.push(seconds * 1000 + nanoseconds / 1000000);
                        resolve();
                    });
                });
            }
            
            const averageUpdateTime = updateTimes.reduce((a, b) => a + b) / updateTimes.length;
            expect(averageUpdateTime).toBeLessThan(100); // Average update should take less than 100ms
        });

        it('should maintain stable memory usage', async () => {
            const initialMemory = process.memoryUsage().heapUsed;
            await memoryExaminer.start();
            
            // Generate and process multiple batches of memory regions
            for (let i = 0; i < 10; i++) {
                const regions = generator.generateRandom(1000);
                await new Promise<void>((resolve) => {
                    memoryExaminer.on('analysis', () => resolve());
                });
            }
            
            const finalMemory = process.memoryUsage().heapUsed;
            const memoryGrowth = finalMemory - initialMemory;
            
            // Memory growth should be reasonable (less than 50MB)
            expect(memoryGrowth).toBeLessThan(50 * 1024 * 1024);
        });
    });
}); 