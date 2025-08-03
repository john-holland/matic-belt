# SPLAT - System Process Lookup and Analysis Tool

SPLAT is a powerful command-line utility that analyzes your terminal environment, monitors system processes, ports, and daemons, and provides intelligent suggestions based on your current system state and user input.

## Features

- 🔍 **Real-time System Analysis**: Monitor CPU, memory, processes, and network ports
- 💡 **Intelligent Suggestions**: Get contextual advice based on your system state and messages
- 📊 **Comprehensive Reporting**: Detailed analysis of your terminal environment
- 🔌 **Port Monitoring**: Track active network ports and services
- 👻 **Daemon Detection**: Identify and analyze background processes
- 📥 **Pipe Support**: Analyze piped input and provide suggestions
- ⚡ **Real-time Monitoring**: Live system monitoring with customizable intervals

## Installation

```bash
cd apps/splat
npm install
npm run build
```

## Usage

### Basic Analysis

```bash
# Analyze current terminal environment
splat analyze

# Verbose analysis with detailed information
splat analyze -v

# Show detailed port information
splat analyze -p

# Show daemon processes
splat analyze -d

# Show environment variables
splat analyze -e
```

### Getting Suggestions

```bash
# Get suggestions based on current system state
splat suggest

# Get suggestions with a specific message
splat suggest -m "I'm having trouble with my Node.js app"

# Interactive mode
splat suggest -i
```

### Real-time Monitoring

```bash
# Start real-time monitoring (updates every 5 seconds)
splat monitor

# Custom update interval (10 seconds)
splat monitor -i 10
```

### Pipe Analysis

```bash
# Analyze piped input
echo "I need help with grep" | splat pipe

# Analyze command output
ps aux | splat pipe

# Analyze log files
tail -f /var/log/syslog | splat pipe
```

## Examples

### Example 1: System Health Check

```bash
$ splat analyze -v
🔍 Analyzing terminal environment...

📊 Analysis Report
Generated at: 12/19/2023, 2:30:45 PM

🖥️  System Information:
  Platform: darwin (arm64)
  Hostname: macbook-pro
  Uptime: 3d 5h 23m
  CPU Usage: 45.2%
  Memory Usage: 78.3%

📋 Processes:
  Top Processes by CPU:
    1. node (PID: 1234) - 25.3% CPU, 12.1% MEM
    2. python (PID: 5678) - 15.7% CPU, 8.9% MEM
    3. chrome (PID: 9012) - 12.4% CPU, 45.2% MEM

🌐 Network Ports:
  3000/tcp - Development (node)
  8080/tcp - Alternative HTTP (python)
  5432/tcp - PostgreSQL (postgres)
```

### Example 2: Getting Suggestions

```bash
$ splat suggest -m "I was trying to make a sandwich with grep, and the salami in the library of congress open source lib went bad, can you run to the store???"

💡 Getting suggestions...

📋 Suggestions:
1. 🥪 Food-related message detected! This might be a metaphor. Check if you need to install or configure something.
2. 🔍 Search-related issue? Try: `grep -r "pattern" .` or `find . -name "*.ext" -exec grep "pattern" {} \;`
3. 📚 Library issue? Check your PATH, LD_LIBRARY_PATH, or try reinstalling the library.
4. 🛒 Installation needed? Try: `brew install` (macOS), `apt install` (Ubuntu), or `npm install` (Node.js)
5. ❌ Error detected in message. Check system logs with `tail -f /var/log/syslog` or `journalctl -f`
```

### Example 3: Real-time Monitoring

```bash
$ splat monitor -i 3

████████████████████████████████████████████████████████████████
█  SPLAT  █
████████████████████████████████████████████████████████████████
Real-time Monitoring

🕐 2:30:45 PM
CPU: 45.2%
Memory: 78.3%
Active Ports: 3
Processes: 156

Top Processes:
  node: 25.3% CPU
  python: 15.7% CPU
  chrome: 12.4% CPU
```

## Command Reference

### `splat analyze`
Analyze the current terminal environment.

**Options:**
- `-v, --verbose`: Verbose output
- `-p, --ports`: Show detailed port information
- `-d, --daemons`: Show daemon processes
- `-e, --environment`: Show environment variables

### `splat suggest`
Get suggestions based on current state and message.

**Options:**
- `-m, --message <message>`: User message describing the situation
- `-i, --interactive`: Interactive mode

### `splat monitor`
Monitor system in real-time.

**Options:**
- `-i, --interval <seconds>`: Update interval in seconds (default: 5)

### `splat pipe`
Analyze piped input and provide suggestions.

## Intelligent Analysis

SPLAT uses pattern recognition to understand your messages and provide relevant suggestions:

- **Food metaphors**: Detects when you're using food-related language as metaphors for technical issues
- **Search terms**: Recognizes grep, find, and search-related problems
- **Library issues**: Identifies library and dependency problems
- **Installation needs**: Suggests appropriate package managers
- **Error patterns**: Detects error-related language and suggests debugging approaches
- **Port/connection issues**: Recognizes networking problems
- **Service/daemon issues**: Identifies service management problems

## System Requirements

- Node.js 16+
- macOS, Linux, or Windows
- Access to system commands (ps, lsof, top, etc.)

## Contributing

Feel free to submit issues and enhancement requests!

## License

MIT License - see LICENSE file for details. 