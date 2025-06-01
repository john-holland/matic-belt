# Memory Examiner

A cross-platform memory examination system that provides real-time memory profiling, pattern recognition, and anomaly detection. The system supports Mac, Linux, and Windows platforms.

## Features

- Real-time memory monitoring and profiling
- Cross-platform support (Mac, Linux, Windows)
- Memory pattern recognition using RNN and Hough transformations
- Anomaly detection for memory leaks and unusual access patterns
- QuadTree-based memory visualization
- Process-specific memory analysis
- File system change tracking

## Installation

```bash
npm install
```

## Usage

```typescript
import memoryExaminer from './src';

// Start memory examination
await memoryExaminer.start();

// Set up event handlers
memoryExaminer.on('memoryUpdate', (info) => {
    console.log('Memory update:', info);
});

memoryExaminer.on('analysis', (result) => {
    console.log('Analysis result:', result);
});

memoryExaminer.on('error', (error) => {
    console.error('Error:', error);
});

// Get memory info
const memoryInfo = await memoryExaminer.getMemoryInfo();
console.log('Memory info:', memoryInfo);

// Get memory regions
const regions = await memoryExaminer.getMemoryRegions();
console.log('Memory regions:', regions);

// Get process memory info
const processInfo = await memoryExaminer.getProcessMemoryInfo(process.pid);
console.log('Process memory info:', processInfo);

// Stop memory examination
await memoryExaminer.stop();
```

## Platform-Specific Features

### Mac
- Uses `vm_stat` and `sysctl` for system memory info
- Uses `vmmap` for process memory regions
- Supports memory region type detection (code, data, heap, stack)

### Linux
- Uses `/proc/meminfo` for system memory info
- Uses `/proc/[pid]/maps` for process memory regions
- Supports memory region permissions and mapping types

### Windows
- Uses `wmic` for system and process memory info
- Uses `handle.exe` (optional) for detailed memory regions
- Supports memory region type detection

## Pattern Recognition

The system uses a combination of RNN (Recurrent Neural Network) and Hough transformations to detect memory patterns:

- Sequential patterns: Regular memory access patterns
- Random patterns: Irregular or scattered memory access
- Cyclic patterns: Repeating memory access patterns
- Anomaly detection: Memory leaks and unusual access patterns

## QuadTree Visualization

Memory regions are organized in a QuadTree structure for efficient spatial queries and visualization:

- Normalized memory addresses (0-1 range)
- Region size and type tracking
- Spatial relationship analysis
- Efficient region querying

## Dependencies

- `@tensorflow/tfjs-node`: For RNN-based pattern recognition
- `eventemitter3`: For event handling
- `node-memwatch`: For memory leak detection

## Development

```bash
# Build
npm run build

# Run tests
npm test

# Development mode
npm run dev
```

## License

MIT 