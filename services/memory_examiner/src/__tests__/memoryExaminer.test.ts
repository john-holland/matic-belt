import { describe, beforeEach, afterEach, it, expect } from '@jest/globals';
import memoryExaminer from '../index';
import { MemoryInfo } from '../types';

describe('MemoryExaminer', () => {
  beforeEach(async () => {
    await memoryExaminer.stop();
  });

  afterEach(async () => {
    await memoryExaminer.stop();
  });

  it('should start and stop memory examination', async () => {
    await memoryExaminer.start();
    expect(memoryExaminer.isActive()).toBe(true);

    await memoryExaminer.stop();
    expect(memoryExaminer.isActive()).toBe(false);
  });

  it('should get memory info', async () => {
    const info = await memoryExaminer.getMemoryInfo();
    expect(info).toBeDefined();
    expect(info.total).toBeGreaterThan(0);
    expect(info.used).toBeGreaterThan(0);
    expect(info.free).toBeGreaterThan(0);
    expect(info.processes).toBeInstanceOf(Array);
    expect(info.regions).toBeInstanceOf(Array);
  });

  it('should get memory regions', async () => {
    const regions = await memoryExaminer.getMemoryRegions();
    expect(regions).toBeInstanceOf(Array);
    expect(regions.length).toBeGreaterThan(0);
    expect(regions[0]).toHaveProperty('address');
    expect(regions[0]).toHaveProperty('size');
    expect(regions[0]).toHaveProperty('type');
  });

  it('should get process memory info', async () => {
    const info = await memoryExaminer.getProcessMemoryInfo(process.pid);
    expect(info).toBeDefined();
    expect(info.total).toBeGreaterThan(0);
    expect(info.used).toBeGreaterThan(0);
    expect(info.free).toBeGreaterThan(0);
    expect(info.processes).toBeInstanceOf(Array);
    expect(info.regions).toBeInstanceOf(Array);
  });

  it('should emit memory update events', (done) => {
    memoryExaminer.on('memoryUpdate', (info: MemoryInfo) => {
      expect(info).toBeDefined();
      expect(info.total).toBeGreaterThan(0);
      expect(info.used).toBeGreaterThan(0);
      expect(info.free).toBeGreaterThan(0);
      done();
    });

    memoryExaminer.start();
  });

  it('should emit analysis events', (done) => {
    memoryExaminer.on('analysis', (result) => {
      expect(result).toBeDefined();
      expect(result.memoryInfo).toBeDefined();
      expect(result.patterns).toBeInstanceOf(Array);
      expect(result.anomalies).toBeInstanceOf(Array);
      done();
    });

    memoryExaminer.start();
  });

  it('should handle errors gracefully', (done) => {
    memoryExaminer.on('error', (error) => {
      expect(error).toBeInstanceOf(Error);
      done();
    });

    // Simulate an error by trying to get memory info for an invalid PID
    memoryExaminer.getProcessMemoryInfo(-1).catch(() => {});
  });
}); 