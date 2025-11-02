/**
 * Integrated Demo Server
 * 
 * Combines Galaxy Consciousness Topology Simulator and Audio Swizzle Visualizer
 * into a unified system that explores relationships between sound and cosmic consciousness
 */

import express from 'express';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import path from 'path';
import { EventEmitter } from 'events';
import GalaxyTopologySimulator from './galaxy-topology';
import AudioSwizzleVisualizer from './audio-swizzle-visualizer';

export class IntegratedDemoServer extends EventEmitter {
    private app!: express.Application;
    private server!: http.Server;
    private io!: SocketIOServer;
    
    private galaxySimulator: GalaxyTopologySimulator;
    private audioVisualizer: AudioSwizzleVisualizer;

    constructor() {
        super();
        this.setupServer();
        
        this.galaxySimulator = new GalaxyTopologySimulator();
        this.audioVisualizer = new AudioSwizzleVisualizer();
        
        this.setupGalaxyListeners();
        this.setupAudioListeners();
        this.setupCrossSystemIntegration();
    }

    private setupServer(): void {
        this.app = express();
        this.server = http.createServer(this.app);
        this.io = new SocketIOServer(this.server, {
            cors: {
                origin: '*',
                methods: ['GET', 'POST']
            }
        });

        // Serve static files
        this.app.use(express.static(path.join(__dirname, '../public')));

        // Routes
        this.app.get('/', (req, res) => {
            res.sendFile(path.join(__dirname, '../public/index.html'));
        });

        this.app.get('/galaxy', (req, res) => {
            res.sendFile(path.join(__dirname, '../public/galaxy-topology.html'));
        });

        this.app.get('/audio-swizzle', (req, res) => {
            res.sendFile(path.join(__dirname, '../public/audio-swizzle.html'));
        });

        this.app.get('/integrated', (req, res) => {
            res.sendFile(path.join(__dirname, '../public/integrated.html'));
        });

        // API endpoints
        this.app.get('/api/galaxy/state', (req, res) => {
            res.json(this.galaxySimulator.getState());
        });

        this.app.get('/api/audio/frame', (req, res) => {
            res.json(this.audioVisualizer.getCurrentFrame());
        });

        this.setupWebSocketHandlers();
    }

    private setupWebSocketHandlers(): void {
        this.io.on('connection', (socket) => {
            console.log('🔌 Client connected');

            // Galaxy simulation controls
            socket.on('startGalaxySimulation', () => {
                this.galaxySimulator.start();
            });

            socket.on('stopGalaxySimulation', () => {
                this.galaxySimulator.stop();
            });

            socket.on('resetGalaxySimulation', () => {
                this.galaxySimulator.stop();
                this.galaxySimulator = new GalaxyTopologySimulator();
                this.setupGalaxyListeners();
            });

            socket.on('injectConsciousness', (data: { galaxyId: string; amount: number }) => {
                this.galaxySimulator.injectConsciousness(data.galaxyId, data.amount);
            });

            socket.on('addGalaxy', (data: { id: string; position: any; mass: number }) => {
                this.galaxySimulator.addGalaxy(data.id, data.position, data.mass);
            });

            // Audio swizzle controls
            socket.on('startAudioSwizzle', (data: { mode: string }) => {
                this.audioVisualizer.start();
            });

            socket.on('stopAudioSwizzle', () => {
                this.audioVisualizer.stop();
            });

            socket.on('audioData', (data: { sourceId: string; audioData: number[]; sampleRate: number }) => {
                const audioBuffer = new Float32Array(data.audioData);
                this.audioVisualizer.processAudio(data.sourceId, audioBuffer, data.sampleRate);
            });

            socket.on('registerAudioSource', (data: { id: string; name: string; color: string }) => {
                this.audioVisualizer.registerSource(data.id, data.name, data.color);
            });

            socket.on('disconnect', () => {
                console.log('🔌 Client disconnected');
            });
        });
    }

    private setupGalaxyListeners(): void {
        this.galaxySimulator.on('update', (state) => {
            this.io.emit('galaxyUpdate', state);
        });

        this.galaxySimulator.on('thirdSpaceEmerged', (thirdSpace) => {
            this.io.emit('thirdSpaceEmerged', thirdSpace);
            console.log('✨ Third Space Emerged!');
        });

        this.galaxySimulator.on('consciousnessInjected', (data) => {
            this.io.emit('consciousnessInjected', data);
        });
    }

    private setupAudioListeners(): void {
        this.audioVisualizer.on('frameUpdate', (frame) => {
            this.io.emit('visualizationFrame', frame);
        });

        this.audioVisualizer.on('sourceRegistered', (source) => {
            this.io.emit('audioSourceRegistered', source);
        });
    }

    /**
     * Setup cross-system integration
     * Audio influences galaxy consciousness and vice versa
     */
    private setupCrossSystemIntegration(): void {
        // Audio affects galaxy consciousness
        this.audioVisualizer.on('frameUpdate', (frame) => {
            if (!frame || !frame.elements || frame.elements.length === 0) return;

            // Calculate average audio energy
            const avgAmplitude = frame.elements.reduce((sum: number, e: any) => sum + e.amplitude, 0) / frame.elements.length;
            const avgFrequency = frame.elements.reduce((sum: number, e: any) => sum + e.frequency, 0) / frame.elements.length;

            // Map audio to consciousness influence
            // High energy sound increases consciousness
            if (avgAmplitude > 0.3) {
                const galaxyState = this.galaxySimulator.getState();
                
                // Inject consciousness based on frequency ranges
                // Low frequencies -> Sagittarius A* (black hole - gravitational)
                // High frequencies -> Milky Way (distributed consciousness)
                
                if (avgFrequency < 500) {
                    this.galaxySimulator.injectConsciousness('sagittarius_a', avgAmplitude * 0.01);
                } else {
                    this.galaxySimulator.injectConsciousness('milkyway', avgAmplitude * 0.01);
                }
            }
        });

        // Galaxy consciousness affects audio visualization colors
        this.galaxySimulator.on('update', (state) => {
            if (!state.thirdSpace) return;

            // When third space emerges, it influences audio visualization
            const consciousnessLevel = state.thirdSpace.consciousnessLevel;
            const annealingProgress = state.thirdSpace.annealingProgress;

            // Broadcast consciousness influence to audio visualization
            this.io.emit('cosmicInfluence', {
                consciousnessLevel,
                annealingProgress,
                resonancePattern: state.thirdSpace.resonancePattern
            });
        });

        // Bidirectional resonance: audio and galaxy sync
        let lastResonanceUpdate = Date.now();
        this.audioVisualizer.on('frameUpdate', (frame) => {
            const now = Date.now();
            if (now - lastResonanceUpdate < 1000) return; // Throttle to 1Hz
            lastResonanceUpdate = now;

            const galaxyState = this.galaxySimulator.getState();
            if (!galaxyState.thirdSpace) return;

            // Calculate audio-galaxy resonance
            const audioEnergy = frame.elements.reduce((sum: number, e: any) => sum + e.amplitude, 0);
            const cosmicEnergy = galaxyState.galaxies.reduce((sum, g) => sum + g.consciousness, 0);
            
            const resonance = Math.abs(audioEnergy - cosmicEnergy / galaxyState.galaxies.length);
            
            this.io.emit('resonanceSync', {
                audioEnergy,
                cosmicEnergy,
                resonance,
                synchronized: resonance < 0.1
            });
        });
    }

    public start(port: number = 3000): void {
        this.server.listen(port, () => {
            console.log('🚀 Integrated Demo Server Started');
            console.log('================================');
            console.log(`🌐 Server running on http://localhost:${port}`);
            console.log('');
            console.log('Available routes:');
            console.log(`  🌌 Galaxy Topology:      http://localhost:${port}/galaxy`);
            console.log(`  🎨 Audio Swizzle:        http://localhost:${port}/audio-swizzle`);
            console.log(`  🔮 Integrated View:      http://localhost:${port}/integrated`);
            console.log('');
            console.log('Features:');
            console.log('  ✨ Galaxy consciousness simulation with parallax reflective topology');
            console.log('  🎵 Multi-dimensional audio-to-visual mapping for accessibility');
            console.log('  🌀 Bidirectional influence between sound and cosmic consciousness');
            console.log('');
        });
    }
}

// Start server if run directly
if (require.main === module) {
    const server = new IntegratedDemoServer();
    const port = parseInt(process.env.PORT || '3000', 10);
    server.start(port);
}

export default IntegratedDemoServer;

