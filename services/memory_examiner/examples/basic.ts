import memoryExaminer from '../src';
import { MemoryInfo } from '../src/types';

async function main() {
  try {
    // Start memory examination
    console.log('Starting memory examination...');
    await memoryExaminer.start();

    // Set up event handlers
    memoryExaminer.on('memoryUpdate', (info: MemoryInfo) => {
      console.log('\nMemory Update:');
      console.log(`Total Memory: ${formatBytes(info.total)}`);
      console.log(`Used Memory: ${formatBytes(info.used)}`);
      console.log(`Free Memory: ${formatBytes(info.free)}`);
      console.log(`Process Count: ${info.processes.length}`);
      console.log(`Region Count: ${info.regions.length}`);
    });

    memoryExaminer.on('analysis', (result) => {
      console.log('\nAnalysis Result:');
      console.log('Patterns:', result.patterns);
      console.log('Anomalies:', result.anomalies);
    });

    memoryExaminer.on('error', (error) => {
      console.error('Error:', error);
    });

    // Get initial memory info
    const info = await memoryExaminer.getMemoryInfo();
    console.log('\nInitial Memory Info:');
    console.log(`Total Memory: ${formatBytes(info.total)}`);
    console.log(`Used Memory: ${formatBytes(info.used)}`);
    console.log(`Free Memory: ${formatBytes(info.free)}`);

    // Get memory regions
    const regions = await memoryExaminer.getMemoryRegions();
    console.log('\nMemory Regions:');
    regions.slice(0, 5).forEach((region) => {
      console.log(`Address: ${region.address.toString(16)}, Size: ${formatBytes(region.size)}, Type: ${region.type}`);
    });

    // Get process memory info
    const processInfo = await memoryExaminer.getProcessMemoryInfo(process.pid);
    console.log('\nProcess Memory Info:');
    console.log(`Total Memory: ${formatBytes(processInfo.total)}`);
    console.log(`Used Memory: ${formatBytes(processInfo.used)}`);
    console.log(`Free Memory: ${formatBytes(processInfo.free)}`);

    // Keep the process running for a while to observe memory updates
    console.log('\nMonitoring memory for 30 seconds...');
    await new Promise((resolve) => setTimeout(resolve, 30000));

    // Stop memory examination
    console.log('\nStopping memory examination...');
    await memoryExaminer.stop();
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

function formatBytes(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  return `${size.toFixed(2)} ${units[unitIndex]}`;
}

main(); 