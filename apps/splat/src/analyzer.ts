import { exec } from 'child_process';
import { promisify } from 'util';
import * as os from 'os';
import * as si from 'systeminformation';
import { 
  AnalysisResult, 
  AnalysisOptions, 
  ProcessInfo, 
  PortInfo, 
  SystemInfo, 
  EnvironmentInfo 
} from './types';

const execAsync = promisify(exec);

export class SplatAnalyzer {
  
  async analyzeEnvironment(options: AnalysisOptions = {}): Promise<AnalysisResult> {
    const [system, processes, ports, environment] = await Promise.all([
      this.getSystemInfo(),
      this.getProcesses(options.daemons),
      this.getPorts(options.ports),
      this.getEnvironmentInfo()
    ]);

    return {
      system,
      processes,
      ports,
      environment,
      timestamp: new Date()
    };
  }

  private async getSystemInfo(): Promise<SystemInfo> {
    const cpuUsage = await this.getCpuUsage();
    const memoryUsage = await this.getMemoryUsage();
    
    return {
      cpuUsage,
      memoryUsage,
      uptime: os.uptime(),
      platform: os.platform(),
      arch: os.arch(),
      hostname: os.hostname()
    };
  }

  private async getCpuUsage(): Promise<number> {
    try {
      const { stdout } = await execAsync('top -l 1 -n 0 | grep "CPU usage"');
      const match = stdout.match(/(\d+\.?\d*)%/);
      return match ? parseFloat(match[1]) : 0;
    } catch {
      // Fallback to systeminformation
      const cpu = await si.cpu();
      return (cpu as any).usage || 0;
    }
  }

  private async getMemoryUsage(): Promise<number> {
    try {
      const { stdout } = await execAsync('vm_stat');
      const lines = stdout.split('\n');
      const pageSize = 4096;
      let totalPages = 0;
      let freePages = 0;

      for (const line of lines) {
        if (line.includes('Pages free:')) {
          freePages = parseInt(line.match(/\d+/)?.[0] || '0');
        }
        if (line.includes('Pages active:')) {
          totalPages += parseInt(line.match(/\d+/)?.[0] || '0');
        }
        if (line.includes('Pages inactive:')) {
          totalPages += parseInt(line.match(/\d+/)?.[0] || '0');
        }
        if (line.includes('Pages wired down:')) {
          totalPages += parseInt(line.match(/\d+/)?.[0] || '0');
        }
      }

      const totalMemory = totalPages * pageSize;
      const freeMemory = freePages * pageSize;
      return totalMemory > 0 ? ((totalMemory - freeMemory) / totalMemory) * 100 : 0;
    } catch {
      // Fallback to systeminformation
      const mem = await si.mem();
      return mem.used / mem.total * 100;
    }
  }

  private async getProcesses(includeDaemons: boolean = false): Promise<ProcessInfo[]> {
    try {
      const { stdout } = await execAsync('ps -eo pid,pcpu,pmem,comm,command');
      const lines = stdout.split('\n').slice(1); // Skip header
      
      return lines
        .map(line => {
          const parts = line.trim().split(/\s+/);
          if (parts.length < 5) return null;
          
          const pid = parseInt(parts[0]);
          const cpu = parseFloat(parts[1]);
          const memory = parseFloat(parts[2]);
          const name = parts[3];
          const command = parts.slice(4).join(' ');
          
          return {
            pid,
            name,
            cpu,
            memory,
            command,
            isDaemon: command.includes('daemon') || name.includes('daemon')
          };
        })
        .filter((proc): proc is ProcessInfo => 
          proc !== null && 
          (includeDaemons || !proc.isDaemon) &&
          proc.cpu > 0
        )
        .sort((a, b) => b.cpu - a.cpu);
    } catch {
      return [];
    }
  }

  private async getPorts(includeDetails: boolean = false): Promise<PortInfo[]> {
    try {
      const { stdout } = await execAsync('lsof -i -P -n | grep LISTEN');
      const lines = stdout.split('\n');
      
      const ports: PortInfo[] = [];
      
      for (const line of lines) {
        const parts = line.trim().split(/\s+/);
        if (parts.length < 9) continue;
        
        const process = parts[0];
        const pid = parseInt(parts[1]);
        const protocol = parts[7];
        const address = parts[8];
        
        const portMatch = address.match(/:(\d+)$/);
        if (!portMatch) continue;
        
        const port = parseInt(portMatch[1]);
        
        ports.push({
          port,
          protocol,
          state: 'LISTEN',
          process: process || 'unknown',
          pid
        });
      }
      
      return ports;
    } catch {
      return [];
    }
  }

  private async getEnvironmentInfo(): Promise<EnvironmentInfo> {
    const variables: Record<string, string> = {};
    
    // Get important environment variables
    const importantVars = [
      'PATH', 'HOME', 'USER', 'SHELL', 'TERM', 'LANG',
      'PWD', 'HOSTNAME', 'LOGNAME', 'TZ'
    ];
    
    for (const varName of importantVars) {
      const value = process.env[varName];
      if (value) {
        variables[varName] = value;
      }
    }

    return {
      variables,
      currentDirectory: process.cwd(),
      user: process.env.USER || process.env.LOGNAME || 'unknown',
      shell: process.env.SHELL || 'unknown'
    };
  }
} 