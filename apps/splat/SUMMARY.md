# SPLAT - System Process Lookup and Analysis Tool

## What is SPLAT?

SPLAT is a powerful command-line utility that analyzes your terminal environment, monitors system processes, ports, and daemons, and provides intelligent suggestions based on your current system state and user input. It's designed to help developers and system administrators quickly understand what's happening on their system and get contextual advice.

## Key Features

### 🔍 Real-time System Analysis
- Monitors CPU, memory, processes, and network ports
- Provides detailed system health information
- Tracks uptime, platform, and architecture details

### 💡 Intelligent Suggestions
- Analyzes user messages for patterns and metaphors
- Provides contextual advice based on system state
- Recognizes common development and troubleshooting scenarios

### 📊 Comprehensive Reporting
- Detailed analysis of terminal environment
- Process prioritization by CPU/memory usage
- Network port identification and service mapping

### 🔌 Port Monitoring
- Tracks active network ports and services
- Identifies common development ports (3000, 8080, etc.)
- Warns about privileged ports (< 1024)

### 👻 Daemon Detection
- Identifies and analyzes background processes
- Helps with service management and troubleshooting

### 📥 Pipe Support
- Analyzes piped input and provides suggestions
- Can process command output and log files
- Real-time analysis of streaming data

## How It Works

### Message Analysis
SPLAT uses pattern recognition to understand your messages:

- **Food metaphors**: Detects when you're using food-related language as metaphors for technical issues
- **Search terms**: Recognizes grep, find, and search-related problems
- **Library issues**: Identifies library and dependency problems
- **Installation needs**: Suggests appropriate package managers
- **Error patterns**: Detects error-related language and suggests debugging approaches
- **Port/connection issues**: Recognizes networking problems
- **Service/daemon issues**: Identifies service management problems

### System Analysis
SPLAT performs comprehensive system analysis:

1. **System Information**: CPU usage, memory usage, uptime, platform
2. **Process Analysis**: Top processes by CPU/memory, daemon detection
3. **Port Scanning**: Active network ports, service identification
4. **Environment Analysis**: Current directory, user, shell, important variables

### Intelligent Suggestions
Based on the analysis, SPLAT provides:

- **System health warnings**: High CPU/memory usage alerts
- **Process recommendations**: Suggestions for process management
- **Port security**: Warnings about privileged ports
- **Development tips**: PM2, virtual environments, Docker suggestions
- **Troubleshooting commands**: Specific commands to try

## Example Usage

### Basic Analysis
```bash
splat analyze
```

### Getting Suggestions
```bash
splat suggest -m "so i was trying to make a sandwich with grep, and the salami in the library of congress open source lib went bad, can you run to the store???"
```

### Pipe Analysis
```bash
echo "I need help with grep and my library is broken" | splat pipe
```

### Real-time Monitoring
```bash
splat monitor -i 5
```

## Installation

1. Navigate to the SPLAT directory:
   ```bash
   cd apps/splat
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Build the project:
   ```bash
   npm run build
   ```

4. Make it globally available (optional):
   ```bash
   ./install.sh
   ```

## Architecture

SPLAT is built with TypeScript and uses:

- **Commander.js**: Command-line interface
- **Chalk**: Colored terminal output
- **SystemInformation**: System data collection
- **Child Process**: Executing system commands
- **OS Module**: Platform information

### Core Components

1. **SplatAnalyzer**: Collects system data and performs analysis
2. **SplatReporter**: Formats and displays analysis results
3. **SplatAdvisor**: Provides intelligent suggestions based on analysis
4. **Main CLI**: Orchestrates the different components

## Why SPLAT?

- **Contextual**: Understands your specific situation and provides relevant advice
- **Intelligent**: Uses pattern recognition to interpret metaphors and technical issues
- **Comprehensive**: Analyzes multiple aspects of your system simultaneously
- **Real-time**: Can monitor your system continuously
- **Pipe-friendly**: Works seamlessly with Unix pipes and command chaining
- **Developer-friendly**: Designed for developers and system administrators

## Future Enhancements

- Machine learning for better suggestion accuracy
- Integration with popular development tools
- Custom suggestion rules and patterns
- Web dashboard for remote monitoring
- Plugin system for extensibility
- Integration with CI/CD pipelines

SPLAT is designed to be your intelligent terminal companion, helping you understand your system and get the right advice when you need it most. 