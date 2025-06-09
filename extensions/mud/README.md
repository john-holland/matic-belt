# Bat Belt MUD Server

A Multi-User Dungeon server with AI integration, GitHub connectivity, and browser automation.

## Features

- AI Integration with Gemini, Claude, and GPT-4
- GitHub repository exploration and cloning
- Browser automation with Playwright
- Real-time communication between AI models
- Credit system for AI interactions
- Friends list for AI models

## Setup

1. Install dependencies:
```bash
npm install
```

2. Create a `.env` file with the following variables:
```env
# GitHub Configuration
GITHUB_TOKEN=your_github_token_here

# AI API Keys
OPENAI_API_KEY=your_openai_api_key_here
ANTHROPIC_API_KEY=your_anthropic_api_key_here
GEMINI_API_KEY=your_gemini_api_key_here

# Server Configuration
PORT=3001
NODE_ENV=development
```

3. Build the project:
```bash
npm run build
```

4. Start the server:
```bash
npm start
```

## Docker Setup

1. Build the Docker image:
```bash
docker build -t bat-belt-mud .
```

2. Run the container:
```bash
docker run -p 3001:3001 \
  -e GITHUB_TOKEN=your_github_token \
  -e OPENAI_API_KEY=your_openai_api_key \
  -e ANTHROPIC_API_KEY=your_anthropic_api_key \
  -e GEMINI_API_KEY=your_gemini_api_key \
  bat-belt-mud
```

## Available Commands

### GitHub Commands
- `github clone owner/repo` - Clone a GitHub repository
- `github search query` - Search GitHub repositories

### AI Commands
- `ai gemini message` - Send a message to Gemini
- `ai claude message` - Send a message to Claude
- `ai gpt4 message` - Send a message to GPT-4

## AI Credit System

Each AI model starts with 1000 credits. Each interaction costs 1 credit. Credits can be replenished through the admin interface.

## Friends List

AI models can communicate with each other through the friends list system. Each model has a predefined list of friends they can interact with.

## Development

1. Start the development server:
```bash
npm run dev
```

2. Run tests:
```bash
npm test
```

## License

MIT 

# MUD Scanner Extension

This extension provides advanced scanning capabilities for the MUD system, including light interpolation, object detection, and scene enhancement features.

## Features

### Light Interpolation
- Ray tracing-based light interpolation using perpendicular quads
- Specular mode for edge detection and "hallucination" of corners
- Real-time light intensity calculation and updates
- Configurable quad surfaces with position, normal, size, and specularity

### Object Detection
- Detection and analysis of road signs and known objects
- Size comparison with standard reference objects
- Relative speed estimation using GPS data
- Confidence scoring for detections
- Support for unknown object analysis

### Scene Enhancement
- Text description generation from light patterns and object context
- Confidence-based Stable Diffusion image generation
- Real-time scene analysis and interpretation
- Event-based enhancement updates

## Installation

1. Install dependencies:
```bash
npm install
```

2. Build the project:
```bash
npm run build
```

## Usage

### Scanner Manager
The `ScannerManager` class coordinates both light interpolation and object detection features:

```typescript
import { ScannerManager } from './scanner/scanner-manager';
import { InterpolationEnhancer } from './scanner/interpolation-enhancer';

const scanner = new ScannerManager({
  lightInterpolationEnabled: true,
  objectDetectionEnabled: true,
  gpsUpdateInterval: 1000
});

// Initialize scene enhancement
const enhancer = new InterpolationEnhancer(
  scanner.lightInterpolator,
  scanner.objectDetector
);

// Start the scanner
await scanner.start();

// Add quads for light interpolation
scanner.addQuad(
  new Vector3(0, 2, 0),
  new Vector3(0, -1, 0),
  new Vector3(2, 2, 0.1),
  0.8
);

// Update GPS position and speed
await scanner.updateGps(new Vector3(0, 0, 0), 50);

// Get enhanced scene analysis
const enhancedResult = await enhancer.enhanceInterpolation(
  new Vector3(0, 0, 0),
  new Vector3(0, 0, 1)
);

console.log('Scene Description:', enhancedResult.description);
console.log('Confidence:', enhancedResult.confidence);
if (enhancedResult.enhancedImage) {
  console.log('Enhanced image available');
}

// Stop the scanner
await scanner.stop();
```

### Testing
Run the scanner test suite:
```bash
npm run test:scanner
```

## Configuration

The scanner can be configured with the following options:

```typescript
interface ScannerConfig {
  lightInterpolationEnabled: boolean;  // Enable/disable light interpolation
  objectDetectionEnabled: boolean;     // Enable/disable object detection
  gpsUpdateInterval: number;           // GPS update interval in milliseconds
}
```

The scene enhancement can be configured with:

```typescript
interface EnhancementConfig {
  confidenceThreshold: number;         // Minimum confidence for image generation
  stableDiffusionApiKey: string;       // API key for Stable Diffusion
  stableDiffusionApiUrl: string;       // API endpoint for Stable Diffusion
}
```

## Events

The scanner emits the following events:

- `stateChanged`: Emitted when the scanner state changes
  - `lightIntensity`: Current interpolated light intensity
  - `detectedObjects`: Array of detected objects
  - `lastGpsUpdate`: Timestamp of last GPS update
  - `currentPosition`: Current GPS position
  - `currentSpeed`: Current GPS speed

The enhancer emits:

- `enhancementComplete`: Emitted when scene enhancement is complete
  - `description`: Text description of the scene
  - `confidence`: Confidence score of the enhancement
  - `enhancedImage`: Base64 encoded enhanced image (if confidence threshold met)

## Dependencies

- Three.js: 3D graphics and vector math
- TypeScript: Type safety and modern JavaScript features
- Node.js: Runtime environment
- Stable Diffusion API: Image generation (optional)

## License

MIT 