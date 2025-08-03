#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import figlet from 'figlet';
import { SplatAnalyzer } from './analyzer';
import { SplatReporter } from './reporter';
import { SplatAdvisor } from './advisor';
import { DwarfBridge } from './dwarf-bridge';
import { CursorIntegration } from './cursor-integration';

const program = new Command();

// ASCII Art Banner with Spider
console.log(chalk.cyan(figlet.textSync('SPLAT', { horizontalLayout: 'full' })));
console.log(chalk.gray('System Process Lookup and Analysis Tool'));
console.log(chalk.red('🕷️  /\\___/\\'));
console.log(chalk.red('   (  o o  )'));
console.log(chalk.red('   (  =^=  )'));
console.log(chalk.red('    (______)'));
console.log(chalk.gray('Spider Process Lookup and Analysis Tool\n'));

program
  .name('splat')
  .description('Analyze terminal environment, ports, daemons, and get suggestions')
  .version('1.0.0');

program
  .command('analyze')
  .description('Analyze current terminal environment')
  .option('-v, --verbose', 'Verbose output')
  .option('-p, --ports', 'Show detailed port information')
  .option('-d, --daemons', 'Show daemon processes')
  .option('-e, --environment', 'Show environment variables')
  .action(async (options) => {
    const analyzer = new SplatAnalyzer();
    const reporter = new SplatReporter();
    
    console.log(chalk.blue('🔍 Analyzing terminal environment...\n'));
    
    const analysis = await analyzer.analyzeEnvironment(options);
    reporter.reportAnalysis(analysis, options);
  });

program
  .command('suggest')
  .description('Get suggestions based on current state and message')
  .option('-m, --message <message>', 'User message describing the situation')
  .option('-i, --interactive', 'Interactive mode')
  .action(async (options) => {
    const analyzer = new SplatAnalyzer();
    const advisor = new SplatAdvisor();
    
    console.log(chalk.green('💡 Getting suggestions...\n'));
    
    const analysis = await analyzer.analyzeEnvironment({ verbose: true });
    const suggestions = await advisor.getSuggestions(analysis, options.message);
    
    console.log(chalk.yellow('📋 Suggestions:'));
    suggestions.forEach((suggestion, index) => {
      console.log(chalk.cyan(`${index + 1}. ${suggestion}`));
    });
  });

program
  .command('monitor')
  .description('Monitor system in real-time')
  .option('-i, --interval <seconds>', 'Update interval in seconds', '5')
  .action(async (options) => {
    const analyzer = new SplatAnalyzer();
    const interval = parseInt(options.interval) * 1000;
    
    console.log(chalk.magenta('📊 Starting real-time monitoring...\n'));
    console.log(chalk.gray(`Update interval: ${options.interval} seconds\n`));
    
    const monitor = setInterval(async () => {
      console.clear();
      console.log(chalk.cyan(figlet.textSync('SPLAT', { horizontalLayout: 'full' })));
      console.log(chalk.gray('Real-time Monitoring'));
      console.log(chalk.red('🕷️  /\\___/\\'));
      console.log(chalk.red('   (  o o  )'));
      console.log(chalk.red('   (  =^=  )'));
      console.log(chalk.red('    (______)'));
      console.log(chalk.gray('Spider Process Lookup and Analysis Tool\n'));
      
      const analysis = await analyzer.analyzeEnvironment({ verbose: true });
      console.log(chalk.blue(`🕐 ${new Date().toLocaleTimeString()}`));
      console.log(chalk.green(`CPU: ${analysis.system.cpuUsage}%`));
      console.log(chalk.yellow(`Memory: ${analysis.system.memoryUsage}%`));
      console.log(chalk.cyan(`Active Ports: ${analysis.ports.length}`));
      console.log(chalk.magenta(`Processes: ${analysis.processes.length}`));
      
      // Show top processes
      const topProcesses = analysis.processes
        .sort((a, b) => b.cpu - a.cpu)
        .slice(0, 5);
      
      console.log(chalk.gray('\nTop Processes:'));
      topProcesses.forEach(proc => {
        console.log(chalk.white(`  ${proc.name}: ${proc.cpu.toFixed(1)}% CPU`));
      });
      
    }, interval);
    
    // Handle graceful shutdown
    process.on('SIGINT', () => {
      clearInterval(monitor);
      console.log(chalk.red('\n🛑 Monitoring stopped'));
      process.exit(0);
    });
  });

program
  .command('pipe')
  .description('Analyze piped input and provide suggestions')
  .action(async () => {
    const analyzer = new SplatAnalyzer();
    const advisor = new SplatAdvisor();
    
    console.log(chalk.blue('📥 Analyzing piped input...\n'));
    
    // Read from stdin
    let input = '';
    process.stdin.setEncoding('utf8');
    
    process.stdin.on('data', (chunk) => {
      input += chunk;
    });
    
    process.stdin.on('end', async () => {
      const analysis = await analyzer.analyzeEnvironment({ verbose: true });
      const suggestions = await advisor.getSuggestions(analysis, input.trim());
      
      console.log(chalk.yellow('📋 Analysis of piped input:'));
      console.log(chalk.gray(`Input length: ${input.length} characters`));
      console.log(chalk.gray(`Lines: ${input.split('\n').length}`));
      
      console.log(chalk.yellow('\n💡 Suggestions:'));
      suggestions.forEach((suggestion, index) => {
        console.log(chalk.cyan(`${index + 1}. ${suggestion}`));
      });
    });
  });

program
  .command('dwarf')
  .description('Connect SPLAT to the dwarf for real-time logging')
  .option('-r, --realtime', 'Start real-time logging to dwarf')
  .option('-i, --interval <seconds>', 'Logging interval in seconds', '5')
  .option('-l, --logs', 'Show dwarf logs')
  .action(async (options) => {
    const bridge = new DwarfBridge();
    
    console.log(chalk.magenta('🧙‍♂️ Connecting SPLAT to Dwarf...\n'));
    
    const connected = await bridge.connectToDwarf();
    
    if (options.logs) {
      console.log(chalk.blue('📜 Dwarf Logs:'));
      const logs = await bridge.getDwarfLogs();
      console.log(logs);
      return;
    }
    
    if (options.realtime) {
      console.log(chalk.green('🕷️🧙‍♂️ Starting real-time SPLAT -> Dwarf logging...'));
      console.log(chalk.gray(`Interval: ${options.interval} seconds\n`));
      
      await bridge.startRealTimeLogging(parseInt(options.interval) * 1000);
    } else {
      // Single analysis and log
      console.log(chalk.blue('🔍 Performing analysis and logging to dwarf...\n'));
      await bridge.analyzeAndLog();
      
      console.log(chalk.green('✅ Analysis logged to dwarf!'));
      console.log(chalk.gray('Use "splat dwarf --logs" to view dwarf logs'));
    }
  });

program
  .command('cursor')
  .description('Generate Cursor query with system analysis')
  .option('-m, --message <message>', 'Your issue or question')
  .option('-f, --file <filename>', 'Output filename', 'cursor-query.md')
  .option('-p, --print', 'Print query to console instead of file')
  .action(async (options) => {
    const cursor = new CursorIntegration();
    
    if (!options.message) {
      console.log(chalk.red('❌ Please provide a message with -m option'));
      console.log(chalk.gray('Example: splat cursor -m "I\'m having trouble with my Node.js app"'));
      return;
    }
    
    console.log(chalk.blue('🎯 Generating Cursor query...\n'));
    
    try {
      if (options.print) {
        const query = await cursor.generateEnhancedQuery(options.message);
        console.log(chalk.cyan('📝 Cursor Query:'));
        console.log(query);
      } else {
        const filePath = await cursor.createCursorQueryFile(options.message, options.file);
        console.log(chalk.green('✅ Cursor query saved to:'));
        console.log(chalk.white(filePath));
        console.log(chalk.gray('\n💡 Copy this content and paste it into Cursor for intelligent assistance!'));
      }
    } catch (error) {
      console.log(chalk.red('❌ Error generating Cursor query:'), error);
    }
  });

// Handle unknown commands
program.on('command:*', () => {
  console.error(chalk.red('Error: Unknown command'));
  program.help();
});

program.parse(); 