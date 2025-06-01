import { BaseMemoryExaminer } from './base';
import { MacMemoryExaminer } from './mac';
import { LinuxMemoryExaminer } from './linux';
import { WindowsMemoryExaminer } from './windows';

export class MemoryExaminerFactory {
    public static create(): BaseMemoryExaminer {
        const platform = process.platform;

        switch (platform) {
            case 'darwin':
                return new MacMemoryExaminer();
            case 'linux':
                return new LinuxMemoryExaminer();
            case 'win32':
                return new WindowsMemoryExaminer();
            default:
                throw new Error(`Unsupported platform: ${platform}`);
        }
    }
} 