#!/bin/bash

# Argument Diffuser Startup Script
echo "🕊️  Starting Argument Diffuser..."

# Check if .env file exists
if [ ! -f .env ]; then
    echo "⚠️  .env file not found. Creating from template..."
    cp env.example .env
    echo "📝 Please edit .env file and add your OpenAI API key before continuing."
    echo "   You can find your API key at: https://platform.openai.com/api-keys"
    echo ""
    echo "Press Enter when you've updated the .env file..."
    read
fi

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

# Build the project
echo "🔨 Building project..."
npm run build

# Start the server
echo "🚀 Starting server..."
npm start







