import { EventEmitter } from 'events';

export interface AudioSample {
    id: string;
    filePath: string;
    mood: string;
    mode: string;
    duration: number;
    sampleRate: number;
    timestamp: number;
    metadata?: {
        volume?: number;
        pitch?: number;
        tempo?: number;
        notes?: string[];
    };
}

export interface TrainingDataset {
    version: string;
    createdAt: string;
    description: string;
    sampleRate: number;
    samples: AudioSample[];
    moods: string[];
    modes: string[];
    statistics: {
        totalSamples: number;
        samplesPerMood: Record<string, number>;
        samplesPerMode: Record<string, number>;
        averageDuration: number;
        totalDuration: number;
    };
}

export class AudioRecorder extends EventEmitter {
    private audioContext: AudioContext | null = null;
    private mediaStream: MediaStream | null = null;
    private mediaRecorder: MediaRecorder | null = null;
    private recordedChunks: Blob[] = [];
    private isRecording: boolean = false;
    private startTime: number = 0;
    private outputDir: string;
    private datasetPath: string;

    constructor(outputDir: string = './audio-training-data', datasetPath: string = './audio-training-data/dataset.json') {
        super();
        this.outputDir = outputDir;
        this.datasetPath = datasetPath;
        this.isNode = typeof require !== 'undefined' && typeof process !== 'undefined' && process.versions && process.versions.node;
        this.ensureDirectoryExists();
    }

    private ensureDirectoryExists() {
        if (this.isNode) {
            const path = require('path');
            const fs = require('fs');
            const dir = path.resolve(this.outputDir);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
        }
    }

    async startRecording(): Promise<void> {
        if (this.isRecording) {
            throw new Error('Already recording');
        }

        try {
            this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
            this.mediaStream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: false,
                    noiseSuppression: false,
                    autoGainControl: false,
                    sampleRate: 44100
                }
            });

            this.recordedChunks = [];
            this.mediaRecorder = new MediaRecorder(this.mediaStream, {
                mimeType: 'audio/webm;codecs=opus'
            });

            this.mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    this.recordedChunks.push(event.data);
                }
            };

            this.mediaRecorder.onstop = () => {
                this.handleRecordingStop();
            };

            this.mediaRecorder.start();
            this.isRecording = true;
            this.startTime = Date.now();
            this.emit('recording-started');
        } catch (error: any) {
            this.emit('error', error);
            throw error;
        }
    }

    async stopRecording(): Promise<Blob> {
        if (!this.isRecording || !this.mediaRecorder) {
            throw new Error('Not recording');
        }

        this.mediaRecorder.stop();
        this.isRecording = false;

        if (this.mediaStream) {
            this.mediaStream.getTracks().forEach(track => track.stop());
        }

        return new Promise((resolve) => {
            this.once('recording-stopped', (blob) => {
                resolve(blob);
            });
        });
    }

    private handleRecordingStop() {
        const blob = new Blob(this.recordedChunks, { type: 'audio/webm;codecs=opus' });
        const duration = (Date.now() - this.startTime) / 1000;
        
        this.emit('recording-stopped', blob, duration);
        
        if (this.mediaStream) {
            this.mediaStream.getTracks().forEach(track => track.stop());
        }
    }

    async saveRecording(blob: Blob, mood: string, mode: string): Promise<AudioSample> {
        const id = `sample_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const fileName = `${id}.webm`;
        let filePath: string;

        if (this.isNode) {
            const path = require('path');
            const fs = require('fs');
            filePath = path.join(this.outputDir, fileName);
            const arrayBuffer = await blob.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);
            fs.writeFileSync(filePath, buffer);
        } else {
            // Browser: save as data URL or use IndexedDB
            filePath = fileName; // Store filename only in browser
            // Could also save to IndexedDB here
        }

        // Analyze audio for metadata
        const metadata = await this.analyzeAudio(blob);

        const sample: AudioSample = {
            id,
            filePath,
            mood,
            mode,
            duration: metadata.duration || 0,
            sampleRate: 44100,
            timestamp: Date.now(),
            metadata
        };

        // Add to dataset
        await this.addSampleToDataset(sample);

        return sample;
    }

    private async analyzeAudio(blob: Blob): Promise<AudioSample['metadata']> {
        try {
            const arrayBuffer = await blob.arrayBuffer();
            const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
            const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

            // Calculate basic audio properties
            const channelData = audioBuffer.getChannelData(0);
            const duration = audioBuffer.duration;
            
            // Calculate RMS volume
            let sumSquares = 0;
            for (let i = 0; i < channelData.length; i++) {
                sumSquares += channelData[i] * channelData[i];
            }
            const rms = Math.sqrt(sumSquares / channelData.length);
            const volume = Math.min(1, rms * 10);

            // Simple pitch detection (autocorrelation)
            const pitch = this.detectPitch(channelData, audioBuffer.sampleRate);

            // Simple tempo detection (onset detection)
            const tempo = this.detectTempo(channelData, audioBuffer.sampleRate);

            return {
                volume,
                pitch,
                tempo,
                duration
            };
        } catch (error) {
            console.error('Error analyzing audio:', error);
            return {};
        }
    }

    private detectPitch(channelData: Float32Array, sampleRate: number): number {
        // Simple autocorrelation-based pitch detection
        const minPeriod = Math.floor(sampleRate / 800); // Max 800 Hz
        const maxPeriod = Math.floor(sampleRate / 80); // Min 80 Hz
        
        let maxCorrelation = 0;
        let bestPeriod = 0;

        for (let period = minPeriod; period < maxPeriod && period < channelData.length / 2; period++) {
            let correlation = 0;
            const samples = Math.min(channelData.length - period, 1000);
            
            for (let i = 0; i < samples; i++) {
                correlation += channelData[i] * channelData[i + period];
            }
            
            correlation /= samples;
            
            if (correlation > maxCorrelation) {
                maxCorrelation = correlation;
                bestPeriod = period;
            }
        }

        return bestPeriod > 0 ? sampleRate / bestPeriod : 0;
    }

    private detectTempo(channelData: Float32Array, sampleRate: number): number {
        // Simple onset detection for tempo
        const threshold = 0.1;
        const onsets: number[] = [];
        
        for (let i = 1; i < channelData.length - 1; i++) {
            const diff = Math.abs(channelData[i] - channelData[i - 1]);
            if (diff > threshold && channelData[i] > channelData[i - 1]) {
                onsets.push(i / sampleRate);
            }
        }

        if (onsets.length < 2) return 0;

        // Calculate average interval between onsets
        let sumIntervals = 0;
        for (let i = 1; i < onsets.length; i++) {
            sumIntervals += onsets[i] - onsets[i - 1];
        }
        const avgInterval = sumIntervals / (onsets.length - 1);
        
        // Convert to BPM
        return avgInterval > 0 ? 60 / avgInterval : 0;
    }

    private async loadDataset(): Promise<TrainingDataset> {
        if (this.isNode) {
            const fs = require('fs');
            if (fs.existsSync(this.datasetPath)) {
                const data = fs.readFileSync(this.datasetPath, 'utf-8');
                return JSON.parse(data);
            }
        } else {
            // Browser: load from localStorage or IndexedDB
            const stored = localStorage.getItem('audio-training-dataset');
            if (stored) {
                return JSON.parse(stored);
            }
        }

        return {
            version: '1.0.0',
            createdAt: new Date().toISOString(),
            description: 'Audio training dataset for mood and mode recognition',
            sampleRate: 44100,
            samples: [],
            moods: [],
            modes: [],
            statistics: {
                totalSamples: 0,
                samplesPerMood: {},
                samplesPerMode: {},
                averageDuration: 0,
                totalDuration: 0
            }
        };
    }

    private async addSampleToDataset(sample: AudioSample): Promise<void> {
        const dataset = await this.loadDataset();
        
        dataset.samples.push(sample);
        
        // Update moods and modes lists
        if (!dataset.moods.includes(sample.mood)) {
            dataset.moods.push(sample.mood);
        }
        if (!dataset.modes.includes(sample.mode)) {
            dataset.modes.push(sample.mode);
        }

        // Update statistics
        this.updateStatistics(dataset);
        
        // Save dataset
        if (this.isNode) {
            const fs = require('fs');
            fs.writeFileSync(this.datasetPath, JSON.stringify(dataset, null, 2));
        } else {
            // Browser: save to localStorage
            localStorage.setItem('audio-training-dataset', JSON.stringify(dataset));
        }
        
        this.emit('sample-saved', sample);
    }

    private updateStatistics(dataset: TrainingDataset): void {
        const totalSamples = dataset.samples.length;
        const samplesPerMood: Record<string, number> = {};
        const samplesPerMode: Record<string, number> = {};
        let totalDuration = 0;

        dataset.samples.forEach(sample => {
            samplesPerMood[sample.mood] = (samplesPerMood[sample.mood] || 0) + 1;
            samplesPerMode[sample.mode] = (samplesPerMode[sample.mode] || 0) + 1;
            totalDuration += sample.duration;
        });

        dataset.statistics = {
            totalSamples,
            samplesPerMood,
            samplesPerMode,
            averageDuration: totalDuration / totalSamples,
            totalDuration
        };
    }

    async getDataset(): Promise<TrainingDataset> {
        return await this.loadDataset();
    }
}

