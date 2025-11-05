#!/bin/bash

# MUD Server Startup Script
# This script starts the MUD server with proper environment setup

echo "🌊 Starting MUD Server..."
echo "========================"

# Navigate to script directory
cd "$(dirname "$0")"

# Check if .env exists
if [ ! -f .env ]; then
    echo "⚠️  .env file not found. Creating from template..."
    cat > .env << EOF
# GitHub Configuration
GITHUB_TOKEN=

# AI API Keys
GEMINI_API_KEY=

# Optional AI API Keys
# OPENAI_API_KEY=
# ANTHROPIC_API_KEY=

# Server Configuration
PORT=3001
NODE_ENV=development
EOF
    echo "✅ Created .env file. Please add your API keys."
fi

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

# Start the server
echo "🚀 Starting MUD server on port ${PORT:-3001}..."
echo ""
echo "Access the MUD at: http://localhost:${PORT:-3001}"
echo "WiFi Scanner: http://localhost:${PORT:-3001}/wifi-scanner.html"
echo ""
echo "Press Ctrl+C to stop"
echo ""

PORT=${PORT:-3001} npm run start

