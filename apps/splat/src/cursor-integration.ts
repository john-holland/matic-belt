import { SplatAnalyzer } from './analyzer';
import { SplatAdvisor } from './advisor';
import { AnalysisResult } from './types';
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import * as os from 'os';

export class CursorIntegration {
  private analyzer: SplatAnalyzer;
  private advisor: SplatAdvisor;

  constructor() {
    this.analyzer = new SplatAnalyzer();
    this.advisor = new SplatAdvisor();
  }

  async generateCursorQuery(userMessage: string): Promise<string> {
    const analysis = await this.analyzer.analyzeEnvironment({ verbose: true });
    
    const query = `# Cursor Query: System Analysis & Suggestions

## Current System State
- **CPU Usage**: ${analysis.system.cpuUsage.toFixed(1)}%
- **Memory Usage**: ${analysis.system.memoryUsage.toFixed(1)}%
- **Platform**: ${analysis.system.platform} (${analysis.system.arch})
- **Uptime**: ${this.formatUptime(analysis.system.uptime)}
- **Hostname**: ${analysis.system.hostname}

## Top Processes
${analysis.processes.slice(0, 5).map((proc, i) => 
  `${i + 1}. **${proc.name}** (PID: ${proc.pid}) - ${proc.cpu.toFixed(1)}% CPU, ${proc.memory.toFixed(1)}% MEM`
).join('\n')}

## Active Network Ports
${analysis.ports.length > 0 ? 
  analysis.ports.slice(0, 5).map(port => 
    `- **${port.port}/${port.protocol}** - ${port.process || 'unknown'}`
  ).join('\n') : 
  '- No active ports found'
}

## User Message
"${userMessage}"

## Context
I'm working in a development environment and need help with the above issue. The system analysis shows the current state of my machine, including resource usage, active processes, and network ports.

## Request
Based on the system analysis and my message, please provide:
1. **Immediate suggestions** for resolving the issue
2. **System optimization tips** if needed
3. **Relevant commands** to run
4. **Potential debugging steps**

Please be specific and actionable in your recommendations.`;

    return query;
  }

  async readCursorContext(): Promise<any> {
    try {
      // Try to read Cursor's workspace context
      const workspacePath = process.cwd();
      const cursorConfigPath = path.join(workspacePath, '.cursor');
      
      let context = {
        workspace: workspacePath,
        files: [],
        gitStatus: null as string | null,
        packageJson: null as any,
        readme: null as string | null
      };

      // Read package.json if it exists
      const packageJsonPath = path.join(workspacePath, 'package.json');
      if (fs.existsSync(packageJsonPath)) {
        try {
          context.packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
        } catch (e) {
          // Ignore parsing errors
        }
      }

      // Read README if it exists
      const readmePaths = ['README.md', 'readme.md', 'README.txt'];
      for (const readmePath of readmePaths) {
        const fullPath = path.join(workspacePath, readmePath);
        if (fs.existsSync(fullPath)) {
          context.readme = fs.readFileSync(fullPath, 'utf8').substring(0, 500) + '...';
          break;
        }
      }

      // Get git status
      try {
        context.gitStatus = execSync('git status --porcelain', { encoding: 'utf8' });
      } catch (e) {
        // Git not available or not a git repo
      }

      return context;
    } catch (error) {
      return { error: 'Could not read Cursor context' };
    }
  }

  async getShellHistory(): Promise<string[]> {
    try {
      const homeDir = os.homedir();
      const historyFiles = [
        path.join(homeDir, '.zsh_history'),
        path.join(homeDir, '.bash_history'),
        path.join(homeDir, '.history')
      ];

      for (const historyFile of historyFiles) {
        if (fs.existsSync(historyFile)) {
          const content = fs.readFileSync(historyFile, 'utf8');
          const lines = content.split('\n').filter(line => line.trim().length > 0);
          // Return last 20 commands
          return lines.slice(-20);
        }
      }
    } catch (error) {
      // Ignore errors
    }
    return [];
  }

  async getRecentFiles(): Promise<string[]> {
    try {
      const workspacePath = process.cwd();
      const recentFiles: string[] = [];
      
      // Get recently modified files in the workspace
      const { execSync } = require('child_process');
      const output = execSync(`find . -type f -name "*.ts" -o -name "*.js" -o -name "*.py" -o -name "*.md" -o -name "*.json" | head -10`, { 
        cwd: workspacePath,
        encoding: 'utf8' 
      });
      
      return output.split('\n').filter((line: string) => line.trim().length > 0);
    } catch (error) {
      return [];
    }
  }

  async getEnvironmentContext(): Promise<any> {
    const env = {
      nodeVersion: process.version,
      npmVersion: null as string | null,
      gitVersion: null as string | null,
      currentShell: process.env.SHELL || 'unknown',
      editor: process.env.EDITOR || process.env.VISUAL || 'unknown',
      language: process.env.LANG || 'unknown',
      timezone: process.env.TZ || 'unknown'
    };

    try {
      env.npmVersion = execSync('npm --version', { encoding: 'utf8' }).trim();
    } catch (e) {}

    try {
      env.gitVersion = execSync('git --version', { encoding: 'utf8' }).trim();
    } catch (e) {}

    return env;
  }

  async getActiveTerminalInfo(): Promise<any> {
    try {
      const { execSync } = require('child_process');
      const currentDir = process.cwd();
      const user = process.env.USER || process.env.USERNAME || 'unknown';
      const hostname = os.hostname();
      
      // Get current git branch if available
      let gitBranch = null;
      try {
        gitBranch = execSync('git branch --show-current', { encoding: 'utf8' }).trim();
      } catch (e) {}

      return {
        currentDirectory: currentDir,
        user,
        hostname,
        gitBranch,
        terminalType: process.env.TERM || 'unknown'
      };
    } catch (error) {
      return { error: 'Could not get terminal info' };
    }
  }

  async generateEnhancedQuery(userMessage: string): Promise<string> {
    const analysis = await this.analyzer.analyzeEnvironment({ verbose: true });
    const cursorContext = await this.readCursorContext();
    const suggestions = await this.advisor.getSuggestions(analysis, userMessage);
    const shellHistory = await this.getShellHistory();
    const recentFiles = await this.getRecentFiles();
    const envContext = await this.getEnvironmentContext();
    const terminalInfo = await this.getActiveTerminalInfo();

    const query = `# Cursor Query: Comprehensive Development Context

## 🖥️ System Analysis
- **CPU Usage**: ${analysis.system.cpuUsage.toFixed(1)}%
- **Memory Usage**: ${analysis.system.memoryUsage.toFixed(1)}%
- **Platform**: ${analysis.system.platform} (${analysis.system.arch})
- **Uptime**: ${this.formatUptime(analysis.system.uptime)}
- **Hostname**: ${analysis.system.hostname}

## 🔥 Top Processes (Resource Usage)
${analysis.processes.slice(0, 5).map((proc, i) => 
  `${i + 1}. **${proc.name}** (PID: ${proc.pid}) - ${proc.cpu.toFixed(1)}% CPU, ${proc.memory.toFixed(1)}% MEM`
).join('\n')}

## 🌐 Active Network Ports
${analysis.ports.length > 0 ? 
  analysis.ports.slice(0, 8).map(port => 
    `- **${port.port}/${port.protocol}** - ${port.process || 'unknown'}`
  ).join('\n') : 
  '- No active ports found'
}

## 📁 Development Environment
- **Workspace**: ${cursorContext.workspace}
- **Project Type**: ${cursorContext.packageJson ? cursorContext.packageJson.name || 'Unknown' : 'Unknown'}
- **Current Directory**: ${terminalInfo.currentDirectory}
- **User**: ${terminalInfo.user}@${terminalInfo.hostname}
- **Terminal**: ${terminalInfo.terminalType}
${terminalInfo.gitBranch ? `- **Git Branch**: ${terminalInfo.gitBranch}` : ''}
${cursorContext.gitStatus ? `- **Git Status**: ${cursorContext.gitStatus.split('\n').filter((l: string) => l.trim()).length} changes` : ''}

## 🛠️ Development Tools
- **Node.js**: ${envContext.nodeVersion}
- **npm**: ${envContext.npmVersion || 'Not available'}
- **Git**: ${envContext.gitVersion || 'Not available'}
- **Shell**: ${envContext.currentShell}
- **Editor**: ${envContext.editor}
- **Language**: ${envContext.language}
- **Timezone**: ${envContext.timezone}

## 📝 Recent Files in Workspace
${recentFiles.length > 0 ? 
  recentFiles.slice(0, 8).map(file => `- \`${file}\``).join('\n') : 
  '- No recent files found'
}

## 📜 Recent Shell Commands (Last 10)
${shellHistory.length > 0 ? 
  shellHistory.slice(-10).map((cmd, i) => `${i + 1}. \`${cmd}\``).join('\n') : 
  '- No shell history available'
}

## 📋 Project Context
${cursorContext.packageJson ? 
  `**Package.json**: ${JSON.stringify(cursorContext.packageJson, null, 2).substring(0, 300)}...` : 
  '- No package.json found'
}

${cursorContext.readme ? 
  `**README**: ${cursorContext.readme}` : 
  '- No README found'
}

## 🎯 User Issue
"${userMessage}"

## 💡 SPLAT Suggestions
${suggestions.map((suggestion, i) => `${i + 1}. ${suggestion}`).join('\n')}

## 🚀 Request for Cursor
I'm experiencing the issue described above. My comprehensive system analysis shows:

**Current Context:**
- Working in a ${cursorContext.packageJson ? cursorContext.packageJson.name : 'development'} project
- Using ${envContext.nodeVersion} with ${envContext.npmVersion ? `npm ${envContext.npmVersion}` : 'package manager'}
- Recent commands show my workflow patterns
- System resources and active processes are listed above
- Network ports indicate running services

**What I need:**
1. **Analyze the system state** in relation to my specific issue
2. **Provide targeted solutions** based on my development context
3. **Suggest debugging steps** considering my recent commands and files
4. **Recommend optimizations** for my specific environment
5. **Provide actionable commands** that work with my current setup

**Please be specific and consider:**
- My recent command history for context
- The files I've been working with
- My current development environment setup
- Any potential conflicts with running processes
- Optimization opportunities based on resource usage

Be specific and provide actionable commands or code snippets where appropriate.`;

    return query;
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

  async createCursorQueryFile(userMessage: string, filename: string = 'cursor-query.md'): Promise<string> {
    const query = await this.generateEnhancedQuery(userMessage);
    const filePath = path.join(process.cwd(), filename);
    
    fs.writeFileSync(filePath, query);
    return filePath;
  }
} 