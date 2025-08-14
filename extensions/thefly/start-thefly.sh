#!/bin/bash

# TheFly Standalone Audio Intelligence App
# This script starts the TheFly standalone application

echo "🪰 Starting TheFly Standalone Audio Intelligence..."
echo "=================================================="

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js first."
    exit 1
fi

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed. Please install npm first."
    exit 1
fi

# Navigate to the script directory
cd "$(dirname "$0")"

# Install dependencies if node_modules doesn't exist
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

# Create recordings directory if it doesn't exist
if [ ! -d "recordings" ]; then
    echo "📁 Creating recordings directory..."
    mkdir -p recordings
fi

# Build the project
echo "🔨 Building TheFly..."
npm run build

# Start the standalone server on port 5556
echo "🚀 Starting TheFly standalone server..."
echo "🌐 Web interface will be available at: http://localhost:5556"
echo "📁 Recordings will be saved to: ./recordings/"
echo "🎯 Interest threshold: 0.7"
echo ""
echo "Press Ctrl+C to stop the server"
echo ""

# Run the standalone app on port 5556
PORT=5556 npm run standalone 