# 🚀 Starting the MUD Server

## Quick Start Commands

### Option 1: Normal Start (Recommended First)
```bash
cd extensions/mud
npm start
```

### Option 2: Using the Startup Script
```bash
cd extensions/mud
./start-mud.sh
```

### Option 3: With Sudo (for WiFi scanning if permissions needed)
```bash
cd extensions/mud
sudo npm start
```

### Option 4: With Custom Port
```bash
cd extensions/mud
PORT=3001 npm start
```

## 🌐 Access the Server

Once started, open:
- **Main MUD Interface**: http://localhost:3001
- **WiFi Scanner**: http://localhost:3001/wifi-scanner.html
- **Health Check**: http://localhost:3001/health

## 📡 WiFi Scanning Permissions

On macOS, WiFi scanning requires location services. Here are your options:

### Option A: Run with Sudo (Quick Fix)
```bash
sudo npm start
```
This gives the process elevated permissions to access WiFi.

### Option B: Grant Location Services Permission
1. Go to **System Preferences** > **Security & Privacy** > **Privacy** > **Location Services**
2. Enable Location Services if not already enabled
3. Find **Terminal** (or your terminal app) in the list
4. Check the box to allow location access
5. Restart the server

### Option C: Package with Info.plist (For Distribution)
If you package this as a macOS app, the `Info.plist` file will request location permissions automatically.

## 📝 Environment Variables

The server loads from `.env` file. Required:
- `GITHUB_TOKEN` - GitHub personal access token
- `GEMINI_API_KEY` - Google Gemini API key

Optional:
- `OPENAI_API_KEY` - For GPT-4 commands
- `ANTHROPIC_API_KEY` - For Claude commands
- `PORT` - Server port (default: 3001)

## 🔍 Troubleshooting

### WiFi shows 0 networks
1. Try running with `sudo npm start`
2. Check System Preferences > Security & Privacy > Location Services
3. Check server logs: `tail -f /tmp/mud-server.log`
4. Verify WiFi is enabled on your Mac

### Port already in use
```bash
# Find and kill process on port 3001
lsof -ti:3001 | xargs kill -9
```

### Missing dependencies
```bash
npm install
```

## 📚 Available Commands in MUD

- `help` - Show available commands
- `github search <query>` - Search GitHub repositories
- `github clone owner/repo` - Get repository info
- `ai gemini <message>` - Chat with Gemini AI
- `wifi` or `scan` - Show WiFi scanner link
- `!history` - Show command history
- `↑` / `↓` - Navigate command history

