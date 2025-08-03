import { exec } from 'child_process';
import { promisify } from 'util';
import { SplatAnalyzer } from './analyzer';
import { AnalysisResult } from './types';

const execAsync = promisify(exec);

export class DwarfBridge {
  private dwarfProcess: any = null;
  private analyzer: SplatAnalyzer;
  private isConnected: boolean = false;

  constructor() {
    this.analyzer = new SplatAnalyzer();
  }

  async connectToDwarf(): Promise<boolean> {
    try {
      // Check if dwarf is available
      const { stdout } = await execAsync('cd ../../../app/dwarf && haxe -main Main -neko dwarf.n');
      console.log('🧙‍♂️ Dwarf bridge initialized...');
      this.isConnected = true;
      return true;
    } catch (error) {
      console.log('❌ Could not connect to dwarf');
      return false;
    }
  }

  async logSplatActivity(activity: string): Promise<void> {
    if (!this.isConnected) {
      console.log('🕷️ SPLAT Activity:', activity);
      return;
    }

    try {
      // Create a temporary Haxe file to log the activity
      const logCode = `
class LogActivity {
  public static function main() {
    var dwarf = new Dwarf();
    trace(dwarf.logSplatActivity("${activity.replace(/"/g, '\\"')}"));
  }
}
`;
      
      await execAsync(`cd ../../../app/dwarf && echo '${logCode}' > temp_log.hx`);
      await execAsync('cd ../../../app/dwarf && haxe -main LogActivity -neko temp_log.n');
      const { stdout } = await execAsync('cd ../../../app/dwarf && neko temp_log.n');
      
      console.log('🕷️🧙‍♂️ SPLAT -> Dwarf:', activity);
    } catch (error) {
      console.log('🕷️ SPLAT Activity:', activity);
    }
  }

  async analyzeAndLog(): Promise<void> {
    try {
      const analysis = await this.analyzer.analyzeEnvironment({ verbose: true });
      
      // Log system analysis
      await this.logSplatActivity(`System analysis: CPU ${analysis.system.cpuUsage.toFixed(1)}%, Memory ${analysis.system.memoryUsage.toFixed(1)}%`);
      
      // Log process information
      const topProcess = analysis.processes[0];
      if (topProcess) {
        await this.logSplatActivity(`Top process: ${topProcess.name} (${topProcess.cpu.toFixed(1)}% CPU)`);
      }
      
      // Log port information
      if (analysis.ports.length > 0) {
        await this.logSplatActivity(`Found ${analysis.ports.length} active ports`);
      }
      
      // Log warnings
      if (analysis.system.cpuUsage > 80) {
        await this.logSplatActivity(`WARNING: High CPU usage detected!`);
      }
      
      if (analysis.system.memoryUsage > 85) {
        await this.logSplatActivity(`WARNING: High memory usage detected!`);
      }
      
    } catch (error) {
      await this.logSplatActivity(`Error during analysis: ${error}`);
    }
  }

  async startRealTimeLogging(intervalMs: number = 5000): Promise<void> {
    console.log('🕷️🧙‍♂️ Starting real-time SPLAT -> Dwarf logging...');
    
    const interval = setInterval(async () => {
      await this.analyzeAndLog();
    }, intervalMs);
    
    // Handle graceful shutdown
    process.on('SIGINT', () => {
      clearInterval(interval);
      console.log('\n🛑 Real-time logging stopped');
      process.exit(0);
    });
  }

  async getDwarfLogs(): Promise<string> {
    try {
      const { stdout } = await execAsync('cd ../../../app/dwarf && neko dwarf.n');
      return stdout;
    } catch (error) {
      return 'Could not retrieve dwarf logs';
    }
  }
} 