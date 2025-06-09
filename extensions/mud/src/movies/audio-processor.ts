import { EventEmitter } from 'events';
import * as tf from '@tensorflow/tfjs';

interface AudioContext {
    timestamp: number;
    scene: string;
    mood: string;
    intensity: number;
    frequency: number;
}

interface AudioAnalysis {
    timestamp: number;
    frequencyData: Float32Array;
    timeData: Float32Array;
    context: AudioContext;
    features: {
        spectralCentroid: number;
        spectralSpread: number;
        spectralFlatness: number;
        spectralRolloff: number;
        zeroCrossingRate: number;
        rms: number;
    };
}

export class AudioProcessor extends EventEmitter {
    private audioContext: AudioContext;
    private analyser: AnalyserNode;
    private source: MediaElementAudioSourceNode | null = null;
    private processor: ScriptProcessorNode | null = null;
    private isProcessing: boolean = false;
    private bufferSize: number = 2048;
    private sampleRate: number = 44100;
    private contextBuffer: AudioContext[] = [];
    private maxContextLength: number = 100;

    constructor() {
        super();
        this.audioContext = {
            timestamp: Date.now(),
            scene: 'unknown',
            mood: 'neutral',
            intensity: 0,
            frequency: 0
        };
    }

    public connectToVideo(videoElement: HTMLVideoElement) {
        const audioContext = new AudioContext();
        this.analyser = audioContext.createAnalyser();
        this.analyser.fftSize = this.bufferSize;

        this.source = audioContext.createMediaElementSource(videoElement);
        this.source.connect(this.analyser);

        this.processor = audioContext.createScriptProcessor(this.bufferSize, 1, 1);
        this.analyser.connect(this.processor);
        this.processor.connect(audioContext.destination);

        this.setupAudioProcessing();
    }

    private setupAudioProcessing() {
        if (!this.processor) return;

        this.processor.onaudioprocess = (event) => {
            if (!this.isProcessing) return;

            const inputData = event.inputBuffer.getChannelData(0);
            const frequencyData = new Float32Array(this.analyser.frequencyBinCount);
            const timeData = new Float32Array(this.analyser.frequencyBinCount);

            this.analyser.getFloatFrequencyData(frequencyData);
            this.analyser.getFloatTimeDomainData(timeData);

            const analysis = this.processAudioData(inputData, frequencyData, timeData);
            this.updateContext(analysis);
            this.emit('analysis', analysis);
        };
    }

    private processAudioData(
        inputData: Float32Array,
        frequencyData: Float32Array,
        timeData: Float32Array
    ): AudioAnalysis {
        const features = this.extractFeatures(frequencyData, timeData);
        const context = this.getCurrentContext();

        return {
            timestamp: Date.now(),
            frequencyData,
            timeData,
            context,
            features
        };
    }

    private extractFeatures(
        frequencyData: Float32Array,
        timeData: Float32Array
    ) {
        return {
            spectralCentroid: this.calculateSpectralCentroid(frequencyData),
            spectralSpread: this.calculateSpectralSpread(frequencyData),
            spectralFlatness: this.calculateSpectralFlatness(frequencyData),
            spectralRolloff: this.calculateSpectralRolloff(frequencyData),
            zeroCrossingRate: this.calculateZeroCrossingRate(timeData),
            rms: this.calculateRMS(timeData)
        };
    }

    private calculateSpectralCentroid(frequencyData: Float32Array): number {
        let numerator = 0;
        let denominator = 0;

        for (let i = 0; i < frequencyData.length; i++) {
            const magnitude = Math.pow(10, frequencyData[i] / 20);
            numerator += i * magnitude;
            denominator += magnitude;
        }

        return denominator === 0 ? 0 : numerator / denominator;
    }

    private calculateSpectralSpread(frequencyData: Float32Array): number {
        const centroid = this.calculateSpectralCentroid(frequencyData);
        let numerator = 0;
        let denominator = 0;

        for (let i = 0; i < frequencyData.length; i++) {
            const magnitude = Math.pow(10, frequencyData[i] / 20);
            numerator += Math.pow(i - centroid, 2) * magnitude;
            denominator += magnitude;
        }

        return denominator === 0 ? 0 : Math.sqrt(numerator / denominator);
    }

    private calculateSpectralFlatness(frequencyData: Float32Array): number {
        let geometricMean = 0;
        let arithmeticMean = 0;

        for (let i = 0; i < frequencyData.length; i++) {
            const magnitude = Math.pow(10, frequencyData[i] / 20);
            geometricMean += Math.log(magnitude + 1e-10);
            arithmeticMean += magnitude;
        }

        geometricMean = Math.exp(geometricMean / frequencyData.length);
        arithmeticMean /= frequencyData.length;

        return arithmeticMean === 0 ? 0 : geometricMean / arithmeticMean;
    }

    private calculateSpectralRolloff(frequencyData: Float32Array): number {
        const threshold = 0.85; // 85% of total energy
        let totalEnergy = 0;
        let currentEnergy = 0;

        for (let i = 0; i < frequencyData.length; i++) {
            const magnitude = Math.pow(10, frequencyData[i] / 20);
            totalEnergy += magnitude;
        }

        const targetEnergy = totalEnergy * threshold;

        for (let i = 0; i < frequencyData.length; i++) {
            const magnitude = Math.pow(10, frequencyData[i] / 20);
            currentEnergy += magnitude;
            if (currentEnergy >= targetEnergy) {
                return i / frequencyData.length;
            }
        }

        return 1;
    }

    private calculateZeroCrossingRate(timeData: Float32Array): number {
        let crossings = 0;
        for (let i = 1; i < timeData.length; i++) {
            if ((timeData[i] >= 0 && timeData[i - 1] < 0) ||
                (timeData[i] < 0 && timeData[i - 1] >= 0)) {
                crossings++;
            }
        }
        return crossings / timeData.length;
    }

    private calculateRMS(timeData: Float32Array): number {
        let sum = 0;
        for (let i = 0; i < timeData.length; i++) {
            sum += timeData[i] * timeData[i];
        }
        return Math.sqrt(sum / timeData.length);
    }

    private updateContext(analysis: AudioAnalysis) {
        // Update current context based on audio analysis
        this.audioContext = {
            timestamp: analysis.timestamp,
            scene: this.detectScene(analysis),
            mood: this.detectMood(analysis),
            intensity: analysis.features.rms,
            frequency: analysis.features.spectralCentroid
        };

        // Add to context buffer
        this.contextBuffer.push(this.audioContext);
        if (this.contextBuffer.length > this.maxContextLength) {
            this.contextBuffer.shift();
        }
    }

    private detectScene(analysis: AudioAnalysis): string {
        // Implement scene detection based on audio features
        const { spectralCentroid, spectralSpread, rms } = analysis.features;
        
        if (rms > 0.8) return 'action';
        if (spectralCentroid > 0.7) return 'tension';
        if (spectralSpread > 0.6) return 'drama';
        return 'dialogue';
    }

    private detectMood(analysis: AudioAnalysis): string {
        // Implement mood detection based on audio features
        const { spectralFlatness, zeroCrossingRate, rms } = analysis.features;
        
        if (rms > 0.7) return 'intense';
        if (spectralFlatness > 0.5) return 'calm';
        if (zeroCrossingRate > 0.3) return 'energetic';
        return 'neutral';
    }

    private getCurrentContext(): AudioContext {
        return { ...this.audioContext };
    }

    public startProcessing() {
        this.isProcessing = true;
    }

    public stopProcessing() {
        this.isProcessing = false;
    }

    public getContextHistory(): AudioContext[] {
        return [...this.contextBuffer];
    }

    public getCurrentContext(): AudioContext {
        return { ...this.audioContext };
    }
} 