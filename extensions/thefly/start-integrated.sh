#!/bin/bash

# Start Integrated Demo Server
# Combines Galaxy Consciousness Topology and Audio Swizzle Visualizer

echo "🚀 Starting TheFly Integrated Demo Server..."
echo "=============================================="
echo ""
echo "This demo includes:"
echo "  🌌 Galaxy Consciousness Topology Simulator"
echo "  🎨 Audio Swizzle Visualizer (Accessibility)"
echo "  🔮 Integrated Cross-System Experience"
echo ""
echo "Press Ctrl+C to stop the server"
echo ""

# Change to the directory where the script is located
cd "$(dirname "$0")"

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

# Build TypeScript files
echo "🔨 Building TypeScript..."
npm run build

# Start the integrated demo server
echo "🎬 Launching integrated demo..."
npm run integrated





