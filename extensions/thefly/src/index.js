const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const AudioProcessor = require('./audioProcessor');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Initialize audio processor
const audioProcessor = new AudioProcessor();

// WebSocket connection handling
io.on('connection', (socket) => {
    console.log('Client connected');

    socket.on('startAudio', async () => {
        const initialized = await audioProcessor.initialize();
        if (initialized) {
            // Start audio processing loop
            const processInterval = setInterval(() => {
                const analysis = audioProcessor.analyzeSound();
                const patterns = audioProcessor.detectPattern(analysis.frequencyData);
                const direction = audioProcessor.getDirectionalInfo(analysis.frequencyData);

                socket.emit('audioData', {
                    ...analysis,
                    patterns,
                    direction
                });
            }, 100); // Process every 100ms

            socket.on('disconnect', () => {
                clearInterval(processInterval);
                console.log('Client disconnected');
            });
        } else {
            socket.emit('error', 'Failed to initialize audio');
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
}); 