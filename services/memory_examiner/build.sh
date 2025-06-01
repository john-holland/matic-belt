#!/bin/bash

# Install dependencies
echo "Installing dependencies..."
npm install

# Build the project
echo "Building the project..."
npm run build

# Run tests
echo "Running tests..."
npm test

# Start the example
echo "Starting the example..."
npm run example 