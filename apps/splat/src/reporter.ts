import chalk from 'chalk';
import { AnalysisResult, AnalysisOptions } from './types';

export class SplatReporter {
  
  reportAnalysis(analysis: AnalysisResult, options: AnalysisOptions = {}): void {
    console.log(chalk.blue('📊 Analysis Report'));
    console.log(chalk.gray(`Generated at: ${analysis.timestamp.toLocaleString()}\n`));
    
    this.reportSystemInfo(analysis.system);
    this.reportProcesses(analysis.processes, options);
    this.reportPorts(analysis.ports, options);
    
    if (options.environment) {
      this.reportEnvironment(analysis.environment);
    }
  }

  private reportSystemInfo(system: AnalysisResult['system']): void {
    console.log(chalk.cyan('🖥️  System Information:'));
    console.log(chalk.white(`  Platform: ${system.platform} (${system.arch})`));
    console.log(chalk.white(`  Hostname: ${system.hostname}`));
    console.log(chalk.white(`  Uptime: ${this.formatUptime(system.uptime)}`));
    console.log(chalk.green(`  CPU Usage: ${system.cpuUsage.toFixed(1)}%`));
    console.log(chalk.yellow(`  Memory Usage: ${system.memoryUsage.toFixed(1)}%`));
    console.log('');
  }

  private reportProcesses(processes: AnalysisResult['processes'], options: AnalysisOptions): void {
    console.log(chalk.magenta('📋 Processes:'));
    
    const topProcesses = processes.slice(0, 10);
    const daemonProcesses = processes.filter(p => p.isDaemon);
    
    if (options.daemons && daemonProcesses.length > 0) {
      console.log(chalk.gray('  Daemon Processes:'));
      daemonProcesses.slice(0, 5).forEach(proc => {
        console.log(chalk.gray(`    ${proc.name} (PID: ${proc.pid}) - ${proc.cpu.toFixed(1)}% CPU`));
      });
      console.log('');
    }
    
    console.log(chalk.white('  Top Processes by CPU:'));
    topProcesses.forEach((proc, index) => {
      const color = proc.cpu > 50 ? chalk.red : proc.cpu > 20 ? chalk.yellow : chalk.green;
      console.log(color(`    ${index + 1}. ${proc.name} (PID: ${proc.pid}) - ${proc.cpu.toFixed(1)}% CPU, ${proc.memory.toFixed(1)}% MEM`));
    });
    console.log('');
  }

  private reportPorts(ports: AnalysisResult['ports'], options: AnalysisOptions): void {
    console.log(chalk.blue('🌐 Network Ports:'));
    
    if (ports.length === 0) {
      console.log(chalk.gray('  No listening ports found'));
      console.log('');
      return;
    }
    
    const commonPorts = {
      22: 'SSH',
      80: 'HTTP',
      443: 'HTTPS',
      3000: 'Development',
      8080: 'Alternative HTTP',
      5432: 'PostgreSQL',
      6379: 'Redis',
      27017: 'MongoDB'
    };
    
    ports.forEach(port => {
      const service = commonPorts[port.port as keyof typeof commonPorts] || 'Unknown';
      const color = port.port < 1024 ? chalk.red : chalk.green;
      console.log(color(`  ${port.port}/${port.protocol} - ${service} (${port.process || 'unknown'})`));
    });
    console.log('');
  }

  private reportEnvironment(environment: AnalysisResult['environment']): void {
    console.log(chalk.cyan('🔧 Environment:'));
    console.log(chalk.white(`  Current Directory: ${environment.currentDirectory}`));
    console.log(chalk.white(`  User: ${environment.user}`));
    console.log(chalk.white(`  Shell: ${environment.shell}`));
    
    console.log(chalk.gray('  Important Variables:'));
    Object.entries(environment.variables).forEach(([key, value]) => {
      if (value.length > 50) {
        value = value.substring(0, 47) + '...';
      }
      console.log(chalk.gray(`    ${key}: ${value}`));
    });
    console.log('');
  }

  private formatUptime(seconds: number): string {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (days > 0) {
      return `${days}d ${hours}h ${minutes}m`;
    } else if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else {
      return `${minutes}m`;
    }
  }
} 