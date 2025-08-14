#!/usr/bin/env node

// TheFly Standalone Demo
// This script demonstrates the TheFly standalone audio intelligence system

const TheFlyStandalone = require('./src/standalone').default;

console.log('🪰 TheFly Standalone Demo');
console.log('==========================');

// Create TheFly instance
const thefly = new TheFlyStandalone();

// Set up event listeners
thefly.on('recordingStarted', (session) => {
    console.log(`🎙️ Recording started: ${session.reason} (score: ${session.interestingScore.toFixed(2)})`);
});

thefly.on('recordingFinished', (session) => {
    console.log(`💾 Recording finished: ${session.reason}`);
    console.log(`📊 Duration: ${session.endTime - session.startTime}ms`);
});

// Start the server
thefly.start(3000);

console.log('🚀 TheFly standalone server started on port 3000');
console.log('🌐 Open http://localhost:3000/standalone.html in your browser');
console.log('🎤 Start speaking or playing music to test the system');
console.log('📁 Recordings will be saved to ./recordings/');
console.log('');
console.log('Press Ctrl+C to stop the server');

// Handle graceful shutdown
process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down TheFly...');
    process.exit(0);
}); 