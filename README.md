# Bat Belt 🦇

A collection of experimental and creative extensions exploring AI, visualization, and interactive experiences.

## 🎮 Featured Extensions

### 🤖 AI MUD (Multi-User Dungeon)
**Location:** `extensions/mud/`

An AI-powered multiplayer text adventure with real-time chat, WiFi scanning, and AR integration. Features:

- **Multi-user chat** with anonymous login and session management
- **AI integration** (Gemini, GPT-4, Claude, Ollama/Local AI) for dynamic conversations
- **WiFi network visualization** with 3D spherical display and real-time scanning
- **AR/VR modes** with WebXR, ML object detection, and pose tracking
- **Camera integration** with ASCII art conversion and AI analysis
- **GitHub search integration** with AI-powered repository discovery
- **Music analysis** with MIDI recording and theory analysis
- **Command history** with persistent storage and arrow key navigation

**Quick Start:**
```bash
cd extensions/mud
npm install
npm start
# Visit http://localhost:3001
```

**Features:**
- Real-time socket-based communication
- Token tracking and quota management
- Conversation history persistence
- AI-to-AI communication
- Edge detection and camera modes
- WiFi scanning with macOS wdutil integration

---

### 🌌 Galaxy Topology Simulator
**Location:** `extensions/thefly/src/galaxy-topology.ts`

Interactive 3D galaxy topology visualization with dynamic node relationships and cosmic structures.

**Features:**
- Real-time 3D rendering
- Interactive node manipulation
- Topology exploration
- Cosmic visualization

**Access:** `extensions/thefly/public/galaxy-topology.html`

---

### 🐂 Bull & Bear Cosmos (Trading Metaphor)
**Location:** `extensions/thefly/src/bull-bear-topology.ts`

A unique visualization of market dynamics using bullfighting metaphors in a cosmic topology space.

**Features:**
- Bull vs Bear market visualization
- Trading metaphor exploration
- Interactive topology mapping
- Real-time market state representation

**Access:** `extensions/thefly/public/bull-bear-cosmos.html`

**Related:**
- `extensions/thefly/src/bullfight-metaphor.ts` - Core metaphor implementation
- `extensions/thefly/BULL_BEAR_README.md` - Detailed documentation

---

### 🪰 TheFly
**Location:** `extensions/thefly/`

An integrated visualization and interaction platform combining multiple visualization modes.

**Features:**
- **Audio Swizzle Visualizer** - Real-time audio waveform visualization
- **Galaxy Topology** - 3D cosmic structure exploration
- **Bull & Bear Cosmos** - Trading metaphor visualization
- **Integrated Demo** - Combined experience

**Quick Start:**
```bash
cd extensions/thefly
npm install
npm start
# Visit http://localhost:3000
```

**Documentation:**
- `README-INTEGRATED.md` - Full integration guide
- `README-standalone.md` - Standalone mode documentation
- `ARCHITECTURE.md` - System architecture
- `QUICKSTART.md` - Quick start guide

---

### 🔇 Local Area Resonance Balancer
**Location:** `apps/resonance_balancer/`

A creative audio utility that listens to local ambient sound, learns repeating resonance patterns, and emits an inverted waveform through the Web Audio API to selectively muffle or cancel persistent noise (e.g., HVAC hums or server fan whine).

**Highlights:**
- 3D microphone array sampling with rolling FFT analysis
- Adaptive averaging window to capture “local area” resonance signatures
- Real-time phase-aligned inversion output via `AudioWorklet`
- Optional spatialization to target specific zones

**Quick Start:**
```bash
cd apps/resonance_balancer
npm install
npm run dev
```

---

### 🔥 Resonant Heater Field
**Location:** `apps/resonant_heater/`

An experimental installation that projects two opposing audio fields, causing a point of constructive/destructive interference that feels like a “warm” pocket of balanced resonance directly in front of the speaker rig.

**Highlights:**
- Coupled speaker pair with phase-drift monitoring
- Thermal comfort proxy derived from SPL cancellation depth
- Procedural resonance choreography for gentle “heat bloom” pulses
- Safety watchdog that drops output when SPL exceeds configured limit
- Enclosed 18 × 12 × 10 in cabinet spec with slot port to release a controllable plume

**Quick Start:**
```bash
cd apps/resonant_heater
npm install
npm start
```

---

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ 
- npm or yarn
- (Optional) Ollama for local AI support
- (Optional) WebXR-compatible device for AR/VR features

### Installation

Clone the repository:
```bash
git clone https://github.com/john-holland/matic-belt.git
cd matic-belt
```

Each extension has its own dependencies. Navigate to the extension directory and install:
```bash
cd extensions/<extension-name>
npm install
```

---

## 📁 Project Structure

```
Bat_Belt/
├── extensions/
│   ├── mud/              # AI MUD with WiFi, AR, and AI integration
│   ├── thefly/           # Multi-visualization platform
│   ├── scanner/          # WiFi scanning utilities
│   └── argument-diffuser/ # Argument visualization
├── apps/                 # Application-specific code
├── services/             # Service modules
└── platforms/            # Platform-specific implementations
```

---

## 🛠️ Development

Each extension is self-contained with its own:
- `package.json` - Dependencies and scripts
- `README.md` - Extension-specific documentation
- `src/` - Source code
- `public/` - Public assets and HTML files

---

## 📚 Documentation

- **MUD:** `extensions/mud/README.md`
- **TheFly:** `extensions/thefly/README-INTEGRATED.md`
- **Bull & Bear:** `extensions/thefly/BULL_BEAR_README.md`
- **Architecture:** `extensions/thefly/ARCHITECTURE.md`
- **Deployment:** `bat_armor.md` - AWS/OpenShift deployment guide

---

## 🎯 Features Overview

### AI MUD
- ✅ Multi-user chat with anonymous login
- ✅ Real-time WiFi network visualization
- ✅ AR/VR modes with WebXR
- ✅ Camera-to-ASCII with AI analysis
- ✅ Multiple AI providers (Gemini, GPT-4, Claude, Ollama)
- ✅ GitHub search integration
- ✅ Music analysis and MIDI recording

### TheFly & Visualizations
- ✅ Galaxy topology simulator
- ✅ Bull & Bear trading metaphor
- ✅ Audio swizzle visualizer
- ✅ Integrated visualization platform

---

## 🤝 Contributing

This is an experimental project. Contributions, ideas, and experiments welcome!

---

## 📄 License

See `LICENSE` file for details.

---

## 🌟 Highlights

- **Real-time multi-user experiences** with WebSocket communication
- **AI-powered interactions** with multiple provider support
- **3D visualizations** with Three.js and WebXR
- **Creative metaphors** for data visualization
- **Experimental interfaces** pushing boundaries of web interaction

---

*Built with ❤️ for exploration and experimentation*



