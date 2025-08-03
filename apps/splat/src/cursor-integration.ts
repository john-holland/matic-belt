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

  async getDeeperTerminalContext(): Promise<any> {
    try {
      const { execSync } = require('child_process');
      
      const context = {
        activeProcesses: [] as any[],
        openFiles: [] as string[],
        networkConnections: [] as any[],
        systemLoad: null as any,
        diskUsage: null as any,
        environmentVariables: {} as any,
        terminalSessions: [] as any[]
      };

      // Get active processes with more detail
      try {
        const psOutput = execSync('ps aux | head -20', { encoding: 'utf8' });
        context.activeProcesses = psOutput.split('\n').slice(1).map((line: string) => {
          const parts = line.trim().split(/\s+/);
          if (parts.length >= 11) {
            return {
              user: parts[0],
              pid: parts[1],
              cpu: parseFloat(parts[2]),
              mem: parseFloat(parts[3]),
              command: parts.slice(10).join(' ')
            };
          }
          return null;
        }).filter(Boolean);
      } catch (e) {}

      // Get open files in current directory
      try {
        const findOutput = execSync('find . -type f -name "*.log" -o -name "*.txt" -o -name "*.json" -o -name "*.js" -o -name "*.ts" | head -10', { 
          cwd: process.cwd(),
          encoding: 'utf8' 
        });
        context.openFiles = findOutput.split('\n').filter((line: string) => line.trim());
      } catch (e) {}

      // Get network connections
      try {
        const netstatOutput = execSync('netstat -an | grep LISTEN | head -10', { encoding: 'utf8' });
        context.networkConnections = netstatOutput.split('\n').filter((line: string) => line.trim()).map((line: string) => {
          const parts = line.trim().split(/\s+/);
          return {
            protocol: parts[0],
            localAddress: parts[3],
            state: parts[5] || 'LISTEN'
          };
        });
      } catch (e) {}

      // Get system load
      try {
        const loadOutput = execSync('uptime', { encoding: 'utf8' });
        context.systemLoad = loadOutput.trim();
      } catch (e) {}

      // Get disk usage
      try {
        const dfOutput = execSync('df -h .', { encoding: 'utf8' });
        context.diskUsage = dfOutput.trim();
      } catch (e) {}

      // Get relevant environment variables
      const relevantEnvVars = [
        'PATH', 'NODE_ENV', 'NODE_OPTIONS', 'DEBUG', 'LOG_LEVEL',
        'PORT', 'HOST', 'DATABASE_URL', 'REDIS_URL', 'AWS_ACCESS_KEY_ID'
      ];
      
      relevantEnvVars.forEach(key => {
        if (process.env[key]) {
          context.environmentVariables[key] = process.env[key];
        }
      });

      // Get terminal sessions
      try {
        const whoOutput = execSync('who', { encoding: 'utf8' });
        context.terminalSessions = whoOutput.split('\n').filter((line: string) => line.trim()).map((line: string) => {
          const parts = line.trim().split(/\s+/);
          return {
            user: parts[0],
            terminal: parts[1],
            time: parts[2] + ' ' + parts[3]
          };
        });
      } catch (e) {}

      return context;
    } catch (error) {
      return { error: 'Could not get deeper terminal context' };
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
    const deeperContext = await this.getDeeperTerminalContext();

    // Detect if this is a terminal/system/Git issue
    const isTerminalIssue = userMessage.toLowerCase().includes('git') || 
                           userMessage.toLowerCase().includes('push') || 
                           userMessage.toLowerCase().includes('commit') ||
                           userMessage.toLowerCase().includes('terminal') ||
                           userMessage.toLowerCase().includes('command') ||
                           userMessage.toLowerCase().includes('error') ||
                           userMessage.toLowerCase().includes('failed') ||
                           userMessage.toLowerCase().includes('crash') ||
                           userMessage.toLowerCase().includes('system');

    const terminalDebuggingPreface = isTerminalIssue ? `
**🔧 TERMINAL & SYSTEM DEBUGGING FOCUS:**
This appears to be a terminal, Git, or system-level issue. Please prioritize:

**Command-Line Debugging:**
- **Git operations** (push, pull, commit, merge conflicts)
- **File system issues** (permissions, large files, disk space)
- **Process management** (hanging processes, resource conflicts)
- **Network connectivity** (ports, services, DNS)
- **Environment variables** and configuration issues
- **Shell and terminal** problems
- **Package manager** issues (npm, yarn, etc.)
- **Build and deployment** failures

**System-Level Investigation:**
- **Resource monitoring** (CPU, memory, disk usage)
- **Process analysis** (what's running, conflicts)
- **Network diagnostics** (ports, connections, services)
- **File system analysis** (large files, permissions, space)
- **Configuration validation** (env vars, settings, paths)
- **Performance profiling** (bottlenecks, optimization)

**Git-Specific Debugging:**
- **Large file handling** (LFS, file size limits)
- **Repository state** (staging, commits, branches)
- **Remote issues** (authentication, connectivity)
- **Merge conflicts** and resolution strategies
- **History management** (rebase, reset, cleanup)

**Alternative Debugging Approaches:**
- **Process monitoring** without relying on logs
- **Network traffic analysis** using system tools
- **Resource usage patterns** and optimization
- **Configuration validation** methods
- **Real-time monitoring** approaches
- **Command-line profiling** techniques
` : '';

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

## 🔍 Deeper Terminal Context
${deeperContext.systemLoad ? `**System Load**: ${deeperContext.systemLoad}` : ''}
${deeperContext.diskUsage ? `**Disk Usage**: \`\`\`\n${deeperContext.diskUsage}\n\`\`\`` : ''}

**Active Processes (Detailed)**:
${deeperContext.activeProcesses.length > 0 ? 
  deeperContext.activeProcesses.slice(0, 5).map((proc: any) => 
    `- **${proc.command}** (PID: ${proc.pid}) - ${proc.cpu}% CPU, ${proc.mem}% MEM`
  ).join('\n') : 
  '- No detailed process info available'
}

**Network Connections**:
${deeperContext.networkConnections.length > 0 ? 
  deeperContext.networkConnections.slice(0, 5).map((conn: any) => 
    `- **${conn.protocol}** ${conn.localAddress} (${conn.state})`
  ).join('\n') : 
  '- No network connection details available'
}

**Environment Variables**:
${Object.keys(deeperContext.environmentVariables).length > 0 ? 
  Object.entries(deeperContext.environmentVariables).map(([key, value]) => 
    `- **${key}**: ${value}`
  ).join('\n') : 
  '- No relevant environment variables found'
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

${terminalDebuggingPreface}

**🔍 IMPORTANT: Please also try to suggest a solution or avenue of investigation that does not use logs.** 
While logs can be helpful, I'm looking for alternative debugging approaches such as:
- **Process monitoring and profiling** techniques
- **Network traffic analysis** without log files
- **Resource usage patterns** and optimization
- **Code-level debugging** strategies
- **Configuration validation** methods
- **Performance profiling** tools
- **Memory leak detection** techniques
- **Real-time monitoring** approaches

**Please be specific and consider:**
- My recent command history for context
- The files I've been working with
- My current development environment setup
- Any potential conflicts with running processes
- Optimization opportunities based on resource usage
- **Alternative debugging methods beyond log analysis**
${isTerminalIssue ? `
- **Command-line specific solutions** and workarounds
- **Git-specific debugging** strategies
- **System-level investigation** techniques
- **Terminal and shell** troubleshooting approaches` : ''}

## 🎯 Actionable Items

**🔍 System Investigation Commands:**
- **Process Analysis**: \`ps aux | grep -E "(node|python|java|docker)"\`
- **Resource Monitoring**: \`top -o cpu\` or \`htop\`
- **Memory Usage**: \`vm_stat\` (macOS) or \`free -h\` (Linux)
- **Disk Space**: \`df -h .\` and \`du -sh * | sort -hr\`
- **Network Connections**: \`netstat -an | grep LISTEN\` or \`lsof -i\`
- **System Load**: \`uptime\` and \`w\`
- **File System**: \`find . -type f -size +100M\` (large files)

**🛠️ Development Environment Checks:**
- **Node.js Processes**: \`pkill -f "node"\` (kill hanging processes)
- **Port Conflicts**: \`lsof -i :3000\` (check specific port)
- **Environment Variables**: \`env | grep -E "(NODE|PATH|PORT)"\`
- **Package Manager**: \`npm list\` or \`yarn list\`
- **Git Status**: \`git status\`, \`git log --oneline -5\`
- **File Permissions**: \`ls -la\` and \`chmod +x script.sh\`

**🌐 Network & Connectivity:**
- **Port Scanning**: \`nmap localhost\` or \`netstat -tulpn\`
- **DNS Resolution**: \`nslookup domain.com\` or \`dig domain.com\`
- **HTTP Testing**: \`curl -I http://localhost:3000\`
- **SSL/TLS**: \`openssl s_client -connect localhost:443\`
- **Firewall**: \`sudo ufw status\` (Linux) or System Preferences (macOS)

**📁 File & Directory Investigation:**
- **Large Files**: \`find . -type f -size +50M -exec ls -lh {} \\;\`
- **Recent Changes**: \`find . -type f -mtime -1\`
- **Hidden Files**: \`ls -la | grep "^\\.\\.*"\`
- **File Types**: \`file filename\` and \`file --mime-type filename\`
- **Directory Structure**: \`tree -L 3\` or \`find . -type d | head -20\`

**🔧 Git & Repository Management:**
- **Large Files in Git**: \`git rev-list --objects --all | git cat-file --batch-check='%(objecttype) %(objectname) %(objectsize) %(rest)' | sed -n 's/^blob //p' | sort -nr -k2 | head -10\`
- **Git LFS**: \`git lfs track "*.log"\` and \`git lfs migrate import --include="*.log"\`
- **Repository Cleanup**: \`git gc --aggressive\` and \`git prune\`
- **Branch Management**: \`git branch -a\` and \`git remote -v\`
- **Stash Operations**: \`git stash list\` and \`git stash pop\`

**⚡ Performance & Optimization:**
- **CPU Profiling**: \`node --prof app.js\` and \`node --prof-process isolate-*.log\`
- **Memory Profiling**: \`node --inspect app.js\` (Chrome DevTools)
- **Process Monitoring**: \`splat monitor\` (real-time system monitoring)
- **Resource Limits**: \`ulimit -a\` and \`sysctl -a | grep limits\`
- **System Calls**: \`strace -p PID\` (Linux) or \`dtruss -p PID\` (macOS)

**🔄 Alternative Debugging Approaches:**
- **Process Tree**: \`pstree\` or \`ps -ef --forest\`
- **System Calls**: \`strace -e trace=network -p PID\`
- **Memory Mapping**: \`cat /proc/PID/maps\` (Linux) or \`vmmap PID\` (macOS)
- **Network Traffic**: \`tcpdump -i lo0 port 3000\`
- **File Descriptors**: \`lsof -p PID\`
- **Signal Handling**: \`kill -l\` and \`kill -USR1 PID\`

**📊 Monitoring & Alerting:**
- **Real-time Monitoring**: \`splat monitor --interval 2\`
- **System Metrics**: \`iostat 1\`, \`vmstat 1\`, \`mpstat 1\`
- **Network Monitoring**: \`iftop\` or \`nethogs\`
- **Process Monitoring**: \`iotop\` (Linux) or Activity Monitor (macOS)
- **Custom Alerts**: \`watch -n 1 'ps aux | grep node'\`

**🔍 Places to Look:**
- **System Logs**: \`/var/log/\` (Linux) or Console.app (macOS)
- **Application Logs**: \`./logs/\`, \`./tmp/\`, \`~/.cache/\`
- **Configuration Files**: \`~/.bashrc\`, \`~/.zshrc\`, \`~/.profile\`
- **Package Directories**: \`node_modules/\`, \`.gradle/\`, \`.m2/\`
- **Temporary Files**: \`/tmp/\`, \`/var/tmp/\`, \`~/.cache/\`
- **Git Objects**: \`.git/objects/\`, \`.git/logs/\`
- **Process Directories**: \`/proc/PID/\` (Linux) or \`/dev/\` (macOS)

**🚨 Emergency Commands:**
- **Force Kill**: \`kill -9 PID\` or \`pkill -9 -f "process_name"\`
- **System Restart**: \`sudo reboot\` or \`sudo shutdown -r now\`
- **Safe Mode**: Boot with \`Cmd+S\` (macOS) or recovery mode
- **Reset Terminal**: \`reset\` or \`clear\`
- **Emergency Cleanup**: \`rm -rf node_modules && npm install\`

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