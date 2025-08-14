import express from 'express';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import path from 'path';
import fs from 'fs';
import { EventEmitter } from 'events';

interface RecordingSession {
    id: string;
    startTime: number;
    endTime?: number;
    audioData: Float32Array[];
    analysis: any;
    interestingScore: number;
    reason: string;
}

interface InterestingCriteria {
    joyScore: number;
    harmonicComplexity: number;
    chorusDetected: boolean;
    unusualPatterns: boolean;
    emotionalIntensity: number;
}

export class TheFlyStandalone extends EventEmitter {
    private app!: express.Application;
    private server!: http.Server;
    private io!: SocketIOServer;
    private recordings: Map<string, RecordingSession> = new Map();
    private isRecording: boolean = false;
    private currentSession: RecordingSession | null = null;
    private audioBuffer: Float32Array[] = [];
    private readonly RECORDINGS_DIR = path.join(__dirname, '../recordings');
    private readonly INTERESTING_THRESHOLD = 0.7;

    constructor() {
        super();
        this.setupServer();
        this.setupRecordingsDirectory();
    }

    private setupServer(): void {
        this.app = express();
        this.server = http.createServer(this.app);
        this.io = new SocketIOServer(this.server);

        // Serve static files
        this.app.use(express.static(path.join(__dirname, 'public')));

        // Root route - serve the standalone HTML
        this.app.get('/', (req, res) => {
            res.sendFile(path.join(__dirname, 'public/standalone.html'));
        });

        // API endpoints
        this.app.get('/api/recordings', (req, res) => {
            const recordings = Array.from(this.recordings.values());
            res.json(recordings);
        });

        this.app.get('/api/recordings/:id', (req, res) => {
            const recording = this.recordings.get(req.params.id);
            if (recording) {
                res.json(recording);
            } else {
                res.status(404).json({ error: 'Recording not found' });
            }
        });

        this.setupWebSocketHandlers();
    }

    private setupRecordingsDirectory(): void {
        if (!fs.existsSync(this.RECORDINGS_DIR)) {
            fs.mkdirSync(this.RECORDINGS_DIR, { recursive: true });
        }
    }

    private setupWebSocketHandlers(): void {
        this.io.on('connection', (socket) => {
            console.log('🪰 TheFly client connected');

            socket.on('startAudio', async () => {
                console.log('🎵 Starting audio analysis...');
                this.startAudioAnalysis(socket);
            });

            socket.on('stopAudio', () => {
                console.log('⏹️ Stopping audio analysis...');
                this.stopAudioAnalysis();
            });

            socket.on('audioData', (data) => {
                this.processAudioData(data, socket);
            });

            socket.on('disconnect', () => {
                console.log('🪰 TheFly client disconnected');
                this.stopAudioAnalysis();
            });
        });
    }

    private startAudioAnalysis(socket: any): void {
        this.isRecording = true;
        this.audioBuffer = [];
        
        console.log('🎤 Audio analysis started - listening for interesting sounds...');
        
        socket.emit('status', { 
            message: 'Audio analysis active - listening for interesting patterns',
            recording: true 
        });
    }

    private stopAudioAnalysis(): void {
        this.isRecording = false;
        if (this.currentSession) {
            this.finishRecording();
        }
        console.log('⏹️ Audio analysis stopped');
    }

    private processAudioData(data: any, socket: any): void {
        if (!this.isRecording) return;

        // Store audio data
        if (data.audioBuffer) {
            this.audioBuffer.push(data.audioBuffer);
        }

        // Simulate audio analysis for demo purposes
        this.simulateAudioAnalysis(data, socket);
    }

    private simulateAudioAnalysis(audioData: any, socket: any): void {
        // Simulate analysis results
        const analysis = {
            joyScore: Math.random() * 0.8 + 0.2,
            harmonicComplexity: Math.random() * 0.6 + 0.2,
            chorusDetected: Math.random() > 0.7,
            unusualPatterns: Math.random() > 0.8,
            emotionalIntensity: Math.random() * 0.9 + 0.1,
            timestamp: Date.now()
        };

        socket.emit('analysis', analysis);
        this.evaluateInterest(analysis);
    }

    private evaluateInterest(analysis: any): void {
        const criteria: InterestingCriteria = {
            joyScore: analysis.joyScore || 0,
            harmonicComplexity: analysis.harmonicComplexity || 0,
            chorusDetected: analysis.chorusDetected || false,
            unusualPatterns: analysis.unusualPatterns || false,
            emotionalIntensity: analysis.emotionalIntensity || 0
        };

        const interestingScore = this.calculateInterestingScore(criteria);
        const reason = this.determineInterestReason(criteria);

        console.log(`🎯 Interest Score: ${interestingScore.toFixed(2)} - ${reason}`);

        if (interestingScore > this.INTERESTING_THRESHOLD) {
            this.startRecording(analysis, interestingScore, reason);
        } else if (this.currentSession && interestingScore < 0.3) {
            this.finishRecording();
        }
    }

    private calculateInterestingScore(criteria: InterestingCriteria): number {
        const weights = {
            joyScore: 0.3,
            harmonicComplexity: 0.2,
            chorusDetected: 0.15,
            unusualPatterns: 0.2,
            emotionalIntensity: 0.15
        };

        return (
            criteria.joyScore * weights.joyScore +
            criteria.harmonicComplexity * weights.harmonicComplexity +
            (criteria.chorusDetected ? 1 : 0) * weights.chorusDetected +
            (criteria.unusualPatterns ? 1 : 0) * weights.unusualPatterns +
            criteria.emotionalIntensity * weights.emotionalIntensity
        );
    }

    private determineInterestReason(criteria: InterestingCriteria): string {
        const reasons = [];
        
        if (criteria.joyScore > 0.8) reasons.push('high joy');
        if (criteria.harmonicComplexity > 0.7) reasons.push('complex harmony');
        if (criteria.chorusDetected) reasons.push('chorus detected');
        if (criteria.unusualPatterns) reasons.push('unusual patterns');
        if (criteria.emotionalIntensity > 0.8) reasons.push('emotional intensity');
        
        return reasons.length > 0 ? reasons.join(', ') : 'moderate interest';
    }

    private startRecording(analysis: any, score: number, reason: string): void {
        if (this.currentSession) return; // Already recording

        const sessionId = `recording_${Date.now()}`;
        this.currentSession = {
            id: sessionId,
            startTime: Date.now(),
            audioData: [...this.audioBuffer],
            analysis,
            interestingScore: score,
            reason
        };

        console.log(`🎙️ Started recording: ${reason} (score: ${score.toFixed(2)})`);
        
        this.emit('recordingStarted', this.currentSession);
        this.io.emit('recordingStatus', {
            recording: true,
            sessionId,
            reason,
            score
        });
    }

    private finishRecording(): void {
        if (!this.currentSession) return;

        this.currentSession.endTime = Date.now();
        this.currentSession.audioData = [...this.audioBuffer];
        
        // Save recording
        this.saveRecording(this.currentSession);
        
        console.log(`💾 Finished recording: ${this.currentSession.reason}`);
        console.log(`📊 Duration: ${this.getRecordingDuration(this.currentSession)}ms`);
        
        this.recordings.set(this.currentSession.id, this.currentSession);
        
        this.emit('recordingFinished', this.currentSession);
        this.io.emit('recordingStatus', {
            recording: false,
            sessionId: this.currentSession.id,
            duration: this.getRecordingDuration(this.currentSession)
        });

        this.currentSession = null;
    }

    private getRecordingDuration(session: RecordingSession): number {
        return (session.endTime || Date.now()) - session.startTime;
    }

    private saveRecording(session: RecordingSession): void {
        const filename = `${session.id}.json`;
        const filepath = path.join(this.RECORDINGS_DIR, filename);
        
        const recordingData = {
            ...session,
            audioDataLength: session.audioData.length,
            // Don't save the actual audio data in JSON (too large)
            audioData: undefined
        };

        fs.writeFileSync(filepath, JSON.stringify(recordingData, null, 2));
        console.log(`💾 Saved recording to: ${filepath}`);
    }

    public start(port: number = 3000): void {
        this.server.listen(port, () => {
            console.log(`🪰 TheFly Standalone running on port ${port}`);
            console.log(`📁 Recordings saved to: ${this.RECORDINGS_DIR}`);
            console.log(`🎯 Interest threshold: ${this.INTERESTING_THRESHOLD}`);
        });
    }

    public getRecordings(): RecordingSession[] {
        return Array.from(this.recordings.values());
    }

    public getRecording(id: string): RecordingSession | undefined {
        return this.recordings.get(id);
    }
}

// Start the standalone app
if (require.main === module) {
    const thefly = new TheFlyStandalone();
    const port = parseInt(process.env.PORT || '3000', 10);
    thefly.start(port);
}

export default TheFlyStandalone; 