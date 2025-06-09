import { DanceInterpolator } from './dance-interpolator';
import { EventEmitter } from 'events';

export class DanceCommandHandler extends EventEmitter {
    private danceInterpolator: DanceInterpolator;
    private isRecording: boolean = false;

    constructor() {
        super();
        this.danceInterpolator = new DanceInterpolator();
        
        // Set up event listeners
        this.danceInterpolator.on('recordingStarted', () => {
            this.emit('status', 'Dance recording started');
        });
        
        this.danceInterpolator.on('recordingStopped', () => {
            this.emit('status', 'Dance recording stopped');
        });
        
        this.danceInterpolator.on('motionCaptured', (data) => {
            this.emit('motion', data);
        });
        
        this.danceInterpolator.on('midiGenerated', (midiData) => {
            this.emit('midi', midiData);
        });
    }

    public handleCommand(command: string): void {
        const normalizedCommand = command.toLowerCase().trim();
        
        switch (normalizedCommand) {
            case 'watch me dance':
                this.startDanceRecording();
                break;
                
            case 'done dancing':
            case 'coda':
                this.stopDanceRecording();
                break;
                
            default:
                // Ignore other commands
                break;
        }
    }

    private startDanceRecording(): void {
        if (this.isRecording) {
            this.emit('status', 'Already recording dance');
            return;
        }
        
        this.isRecording = true;
        this.danceInterpolator.startRecording();
    }

    private stopDanceRecording(): void {
        if (!this.isRecording) {
            this.emit('status', 'No dance recording in progress');
            return;
        }
        
        this.isRecording = false;
        this.danceInterpolator.stopRecording();
        
        // Get and emit the analysis
        const analysis = this.danceInterpolator.getAnalysis();
        this.emit('analysis', analysis);
    }

    public getAnalysis(): string {
        return this.danceInterpolator.getAnalysis();
    }
} 