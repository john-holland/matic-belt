import chalk from 'chalk';
import { AnalysisResult, Suggestion } from './types';

export class SplatAdvisor {
  
  async getSuggestions(analysis: AnalysisResult, userMessage?: string): Promise<string[]> {
    const suggestions: string[] = [];
    
    // System health suggestions
    suggestions.push(...this.getSystemHealthSuggestions(analysis));
    
    // Process-specific suggestions
    suggestions.push(...this.getProcessSuggestions(analysis));
    
    // Port-specific suggestions
    suggestions.push(...this.getPortSuggestions(analysis));
    
    // User message analysis
    if (userMessage) {
      suggestions.push(...this.analyzeUserMessage(userMessage, analysis));
    }
    
    // General optimization suggestions
    suggestions.push(...this.getOptimizationSuggestions(analysis));
    
    return suggestions.slice(0, 10); // Limit to top 10 suggestions
  }

  private getSystemHealthSuggestions(analysis: AnalysisResult): string[] {
    const suggestions: string[] = [];
    
    if (analysis.system.cpuUsage > 80) {
      suggestions.push('🚨 High CPU usage detected! Consider closing unnecessary applications or checking for runaway processes.');
    }
    
    if (analysis.system.memoryUsage > 85) {
      suggestions.push('💾 High memory usage! Try clearing browser tabs or restarting memory-intensive applications.');
    }
    
    if (analysis.system.uptime > 86400 * 7) { // 7 days
      suggestions.push('⏰ System has been running for over a week. Consider a restart for optimal performance.');
    }
    
    return suggestions;
  }

  private getProcessSuggestions(analysis: AnalysisResult): string[] {
    const suggestions: string[] = [];
    
    const highCpuProcesses = analysis.processes.filter(p => p.cpu > 50);
    if (highCpuProcesses.length > 0) {
      const topProcess = highCpuProcesses[0];
      suggestions.push(`🔥 High CPU process detected: ${topProcess.name} (${topProcess.cpu.toFixed(1)}% CPU). Consider investigating.`);
    }
    
    const developmentProcesses = analysis.processes.filter(p => 
      p.name.includes('node') || 
      p.name.includes('python') || 
      p.name.includes('java') ||
      p.name.includes('go')
    );
    
    if (developmentProcesses.length > 5) {
      suggestions.push('👨‍💻 Multiple development processes running. Consider using a process manager like PM2 or Supervisor.');
    }
    
    return suggestions;
  }

  private getPortSuggestions(analysis: AnalysisResult): string[] {
    const suggestions: string[] = [];
    
    const commonDevPorts = [3000, 8080, 5000, 4000, 8000];
    const devPorts = analysis.ports.filter(p => commonDevPorts.includes(p.port));
    
    if (devPorts.length > 0) {
      suggestions.push('🌐 Development servers detected on common ports. Make sure these are intentional.');
    }
    
    const privilegedPorts = analysis.ports.filter(p => p.port < 1024);
    if (privilegedPorts.length > 0) {
      suggestions.push('🔒 Services running on privileged ports (< 1024). Ensure these are necessary for security.');
    }
    
    if (analysis.ports.length === 0) {
      suggestions.push('🔍 No listening ports found. If you\'re expecting a service, check if it\'s running properly.');
    }
    
    return suggestions;
  }

  private analyzeUserMessage(message: string, analysis: AnalysisResult): string[] {
    const suggestions: string[] = [];
    const lowerMessage = message.toLowerCase();
    
    // Analyze message content for common patterns
    if (lowerMessage.includes('sandwich') || lowerMessage.includes('food')) {
      suggestions.push('🥪 Food-related message detected! This might be a metaphor. Check if you need to install or configure something.');
    }
    
    if (lowerMessage.includes('grep') || lowerMessage.includes('search')) {
      suggestions.push('🔍 Search-related issue? Try: `grep -r "pattern" .` or `find . -name "*.ext" -exec grep "pattern" {} \\;`');
    }
    
    if (lowerMessage.includes('library') || lowerMessage.includes('lib')) {
      suggestions.push('📚 Library issue? Check your PATH, LD_LIBRARY_PATH, or try reinstalling the library.');
    }
    
    if (lowerMessage.includes('store') || lowerMessage.includes('install')) {
      suggestions.push('🛒 Installation needed? Try: `brew install` (macOS), `apt install` (Ubuntu), or `npm install` (Node.js)');
    }
    
    if (lowerMessage.includes('bad') || lowerMessage.includes('error')) {
      suggestions.push('❌ Error detected in message. Check system logs with `tail -f /var/log/syslog` or `journalctl -f`');
    }
    
    if (lowerMessage.includes('port') || lowerMessage.includes('connection')) {
      suggestions.push('🔌 Port/connection issue? Check with `netstat -tulpn` or `lsof -i`');
    }
    
    if (lowerMessage.includes('daemon') || lowerMessage.includes('service')) {
      suggestions.push('👻 Daemon/service issue? Try `systemctl status service-name` or `brew services list`');
    }
    
    return suggestions;
  }

  private getOptimizationSuggestions(analysis: AnalysisResult): string[] {
    const suggestions: string[] = [];
    
    // Check for common development patterns
    const nodeProcesses = analysis.processes.filter(p => p.name.includes('node'));
    if (nodeProcesses.length > 3) {
      suggestions.push('⚡ Multiple Node.js processes? Consider using PM2: `npm install -g pm2 && pm2 start app.js`');
    }
    
    const pythonProcesses = analysis.processes.filter(p => p.name.includes('python'));
    if (pythonProcesses.length > 2) {
      suggestions.push('🐍 Multiple Python processes? Consider using virtual environments or process managers.');
    }
    
    // Check for potential security issues
    const rootProcesses = analysis.processes.filter(p => p.command.includes('root'));
    if (rootProcesses.length > 5) {
      suggestions.push('🔐 Many root processes detected. Consider running services as non-root users for security.');
    }
    
    // Check for development environment
    const devTools = analysis.processes.filter(p => 
      p.name.includes('vscode') || 
      p.name.includes('code') || 
      p.name.includes('sublime') ||
      p.name.includes('vim') ||
      p.name.includes('emacs')
    );
    
    if (devTools.length > 0) {
      suggestions.push('💻 Development environment detected. Consider using Docker for consistent development environments.');
    }
    
    return suggestions;
  }
} 