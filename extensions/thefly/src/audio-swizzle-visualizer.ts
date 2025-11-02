/**
 * Audio Swizzle Visualizer
 * 
 * Multi-dimensional live sound-to-visual mapping system for accessibility
 * Designed to help deaf users "see" sound through rich visual representations
 * 
 * Mapping Strategy:
 * - Height: Pitch (frequency)
 * - Width: Resonance (harmonic richness)
 * - Color: Treble (high frequencies) vs Bass (low frequencies)
 * - Brightness: Volume (amplitude)
 * - Depth (Z): Spectral centroid (timbral brightness)
 * - Shape: Waveform characteristics
 * - Motion: Temporal changes
 * 
 * Multi-source identification using spatial separation and color coding
 */

import { EventEmitter } from 'events';
const fft = require('fft-js');

export interface AudioSource {
    id: string;
    name: string;
    color: string; // Base color for this source
    position: { x: number; y: number; z: number };
    active: boolean;
}

export interface VisualizationFrame {
    timestamp: number;
    elements: VisualElement[];
    globalMetrics: GlobalAudioMetrics;
}

export interface VisualElement {
    sourceId: string;
    
    // Spatial dimensions
    x: number; // Width (0-1): Resonance
    y: number; // Height (0-1): Pitch
    z: number; // Depth (0-1): Spectral centroid
    
    // Visual properties
    color: { r: number; g: number; b: number }; // Treble/Bass mapped
    brightness: number; // Volume (0-1)
    size: number; // Harmonic complexity
    shape: ShapeType; // Waveform characteristic
    
    // Motion properties
    velocity: { x: number; y: number; z: number };
    rotation: number;
    
    // Audio properties
    frequency: number; // Hz
    amplitude: number; // 0-1
    harmonics: number[]; // Harmonic series strengths
    spectralCentroid: number; // Hz
    spectralSpread: number;
    zcr: number; // Zero-crossing rate
}

export type ShapeType = 'circle' | 'square' | 'triangle' | 'star' | 'wave' | 'spike';

export interface GlobalAudioMetrics {
    overallVolume: number;
    dominantFrequency: number;
    spectralEnergy: number[];
    numActiveSources: number;
}

export interface AudioAnalysisConfig {
    fftSize: number;
    smoothingConstant: number;
    minFrequency: number;
    maxFrequency: number;
    freqBands: number;
    updateRate: number; // Hz
}

export class AudioSwizzleVisualizer extends EventEmitter {
    private sources: Map<string, AudioSource> = new Map();
    private currentFrame: VisualizationFrame | null = null;
    private isRunning: boolean = false;
    private updateInterval: NodeJS.Timeout | null = null;
    
    private config: AudioAnalysisConfig;
    
    // Frequency band definitions
    private readonly SUB_BASS_MAX = 60; // Hz
    private readonly BASS_MAX = 250;
    private readonly LOW_MID_MAX = 500;
    private readonly MID_MAX = 2000;
    private readonly HIGH_MID_MAX = 4000;
    private readonly PRESENCE_MAX = 6000;
    private readonly BRILLIANCE_MAX = 20000;

    constructor(config?: Partial<AudioAnalysisConfig>) {
        super();
        
        this.config = {
            fftSize: config?.fftSize || 2048,
            smoothingConstant: config?.smoothingConstant || 0.8,
            minFrequency: config?.minFrequency || 20,
            maxFrequency: config?.maxFrequency || 20000,
            freqBands: config?.freqBands || 32,
            updateRate: config?.updateRate || 60
        };
    }

    /**
     * Register an audio source
     */
    public registerSource(id: string, name: string, color: string): void {
        this.sources.set(id, {
            id,
            name,
            color,
            position: { 
                x: Math.random(), 
                y: Math.random(), 
                z: Math.random() 
            },
            active: false
        });
        
        this.emit('sourceRegistered', { id, name, color });
    }

    /**
     * Start visualization
     */
    public start(): void {
        if (this.isRunning) return;

        this.isRunning = true;
        const intervalMs = 1000 / this.config.updateRate;
        
        this.updateInterval = setInterval(() => {
            this.update();
        }, intervalMs);

        console.log('🎨 Audio Swizzle Visualizer Started');
        this.emit('visualizerStarted', { timestamp: Date.now() });
    }

    /**
     * Stop visualization
     */
    public stop(): void {
        if (!this.isRunning) return;

        this.isRunning = false;
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
        }

        console.log('🎨 Audio Swizzle Visualizer Stopped');
        this.emit('visualizerStopped', { timestamp: Date.now() });
    }

    /**
     * Process audio data from a source
     */
    public processAudio(sourceId: string, audioData: Float32Array, sampleRate: number): void {
        const source = this.sources.get(sourceId);
        if (!source) {
            console.warn(`Unknown source: ${sourceId}`);
            return;
        }

        source.active = true;

        // Perform FFT analysis
        const fftData = this.performFFT(audioData);
        
        // Extract audio features
        const features = this.extractFeatures(fftData, audioData, sampleRate);
        
        // Create visual element
        const element = this.createVisualElement(sourceId, features, source);
        
        // Update current frame
        if (!this.currentFrame) {
            this.currentFrame = {
                timestamp: Date.now(),
                elements: [],
                globalMetrics: this.calculateGlobalMetrics([])
            };
        }

        // Replace or add element for this source
        const existingIndex = this.currentFrame.elements.findIndex(e => e.sourceId === sourceId);
        if (existingIndex >= 0) {
            // Smooth transition from previous element
            const prev = this.currentFrame.elements[existingIndex];
            element.velocity = {
                x: (element.x - prev.x) * this.config.updateRate,
                y: (element.y - prev.y) * this.config.updateRate,
                z: (element.z - prev.z) * this.config.updateRate
            };
            this.currentFrame.elements[existingIndex] = element;
        } else {
            this.currentFrame.elements.push(element);
        }

        this.currentFrame.timestamp = Date.now();
        this.currentFrame.globalMetrics = this.calculateGlobalMetrics(this.currentFrame.elements);
    }

    /**
     * Perform FFT on audio data
     */
    private performFFT(audioData: Float32Array): number[] {
        const fftSize = this.config.fftSize;
        
        // Prepare input array with Hann window
        const input: number[] = [];
        for (let i = 0; i < fftSize; i++) {
            const window = 0.5 * (1 - Math.cos(2 * Math.PI * i / fftSize));
            const value = i < audioData.length ? audioData[i] * window : 0;
            input.push(value);
        }

        // Perform FFT using fft-js
        const phasors = fft.fft(input);
        
        // Calculate magnitudes
        const magnitudes: number[] = [];
        for (let i = 0; i < fftSize / 2; i++) {
            const real = phasors[i][0];
            const imag = phasors[i][1];
            magnitudes.push(Math.sqrt(real * real + imag * imag));
        }

        return magnitudes;
    }

    /**
     * Extract audio features from FFT data
     */
    private extractFeatures(fftData: number[], audioData: Float32Array, sampleRate: number) {
        // Dominant frequency (pitch)
        const dominantFreq = this.findDominantFrequency(fftData, sampleRate);
        
        // Overall amplitude
        const amplitude = this.calculateRMS(audioData);
        
        // Harmonic series
        const harmonics = this.extractHarmonics(fftData, dominantFreq, sampleRate);
        
        // Spectral centroid (brightness)
        const spectralCentroid = this.calculateSpectralCentroid(fftData, sampleRate);
        
        // Spectral spread (width of frequency distribution)
        const spectralSpread = this.calculateSpectralSpread(fftData, spectralCentroid, sampleRate);
        
        // Zero-crossing rate (noisiness)
        const zcr = this.calculateZeroCrossingRate(audioData);
        
        // Frequency band energies
        const bandEnergies = this.calculateBandEnergies(fftData, sampleRate);
        
        // Resonance (harmonic richness)
        const resonance = harmonics.reduce((sum, h) => sum + h, 0) / harmonics.length;

        return {
            dominantFreq,
            amplitude,
            harmonics,
            spectralCentroid,
            spectralSpread,
            zcr,
            bandEnergies,
            resonance
        };
    }

    /**
     * Create visual element from audio features
     */
    private createVisualElement(sourceId: string, features: any, source: AudioSource): VisualElement {
        // Map pitch to height (logarithmic scale for musical perception)
        const minFreq = Math.log(this.config.minFrequency);
        const maxFreq = Math.log(this.config.maxFrequency);
        const normalizedPitch = (Math.log(features.dominantFreq + 1) - minFreq) / (maxFreq - minFreq);
        const y = Math.max(0, Math.min(1, normalizedPitch));

        // Map resonance to width
        const x = Math.max(0, Math.min(1, features.resonance));

        // Map spectral centroid to depth
        const z = Math.max(0, Math.min(1, 
            (features.spectralCentroid - this.config.minFrequency) / 
            (this.config.maxFrequency - this.config.minFrequency)
        ));

        // Map treble/bass to color
        const color = this.mapFrequencyToColor(features.bandEnergies, source.color);

        // Map volume to brightness - boost significantly for visibility
        const brightness = Math.max(0.2, Math.min(1, features.amplitude * 3));

        // Map harmonic complexity to size - make larger and more visible
        const size = Math.max(0.3, Math.min(1, features.harmonics.length / 5));

        // Map waveform characteristics to shape
        const shape = this.determineShape(features);

        return {
            sourceId,
            x,
            y,
            z,
            color,
            brightness,
            size,
            shape,
            velocity: { x: 0, y: 0, z: 0 },
            rotation: features.zcr * Math.PI * 2,
            frequency: features.dominantFreq,
            amplitude: features.amplitude,
            harmonics: features.harmonics,
            spectralCentroid: features.spectralCentroid,
            spectralSpread: features.spectralSpread,
            zcr: features.zcr
        };
    }

    /**
     * Map frequency bands to RGB color
     * Bass -> Red/Orange, Mid -> Green/Yellow, Treble -> Blue/Purple
     */
    private mapFrequencyToColor(bandEnergies: any, baseColor: string): { r: number; g: number; b: number } {
        const bass = bandEnergies.bass;
        const mid = bandEnergies.mid;
        const treble = bandEnergies.treble;

        // Parse base color (simple hex parsing)
        let r = 128, g = 128, b = 128;
        if (baseColor.startsWith('#')) {
            r = parseInt(baseColor.substr(1, 2), 16);
            g = parseInt(baseColor.substr(3, 2), 16);
            b = parseInt(baseColor.substr(5, 2), 16);
        }

        // Modulate based on frequency content - boost color saturation
        r = Math.min(255, r * (1 + bass * 2));
        g = Math.min(255, g * (1 + mid * 2));
        b = Math.min(255, b * (1 + treble * 2));

        return { r, g, b };
    }

    /**
     * Determine shape based on waveform characteristics
     */
    private determineShape(features: any): ShapeType {
        const { harmonics, zcr, spectralSpread } = features;

        // Many harmonics -> Star (rich sound)
        if (harmonics.length > 8) return 'star';

        // High ZCR -> Spike (noisy)
        if (zcr > 0.5) return 'spike';

        // Wide spread -> Wave (complex)
        if (spectralSpread > 2000) return 'wave';

        // Few harmonics -> Triangle (simple)
        if (harmonics.length < 3) return 'triangle';

        // Medium complexity -> Square
        if (harmonics.length < 6) return 'square';

        // Default -> Circle
        return 'circle';
    }

    /**
     * Find dominant frequency from FFT data
     */
    private findDominantFrequency(fftData: number[], sampleRate: number): number {
        let maxMag = 0;
        let maxIndex = 0;

        for (let i = 1; i < fftData.length; i++) {
            if (fftData[i] > maxMag) {
                maxMag = fftData[i];
                maxIndex = i;
            }
        }

        return (maxIndex * sampleRate) / this.config.fftSize;
    }

    /**
     * Calculate RMS amplitude
     */
    private calculateRMS(audioData: Float32Array): number {
        let sum = 0;
        for (let i = 0; i < audioData.length; i++) {
            sum += audioData[i] * audioData[i];
        }
        // Boost sensitivity significantly - amplify by 20x and use power curve
        const rms = Math.sqrt(sum / audioData.length);
        return Math.pow(rms * 20, 0.7); // Power curve for better dynamic range
    }

    /**
     * Extract harmonic series
     */
    private extractHarmonics(fftData: number[], fundamental: number, sampleRate: number): number[] {
        const harmonics: number[] = [];
        const binWidth = sampleRate / this.config.fftSize;

        for (let h = 1; h <= 16; h++) {
            const harmonicFreq = fundamental * h;
            const bin = Math.round(harmonicFreq / binWidth);

            if (bin < fftData.length) {
                harmonics.push(fftData[bin]);
            }
        }

        return harmonics;
    }

    /**
     * Calculate spectral centroid (center of mass of spectrum)
     */
    private calculateSpectralCentroid(fftData: number[], sampleRate: number): number {
        let weightedSum = 0;
        let totalMag = 0;

        for (let i = 0; i < fftData.length; i++) {
            const freq = (i * sampleRate) / this.config.fftSize;
            weightedSum += freq * fftData[i];
            totalMag += fftData[i];
        }

        return totalMag > 0 ? weightedSum / totalMag : 0;
    }

    /**
     * Calculate spectral spread (width of spectrum)
     */
    private calculateSpectralSpread(fftData: number[], centroid: number, sampleRate: number): number {
        let sum = 0;
        let totalMag = 0;

        for (let i = 0; i < fftData.length; i++) {
            const freq = (i * sampleRate) / this.config.fftSize;
            const diff = freq - centroid;
            sum += diff * diff * fftData[i];
            totalMag += fftData[i];
        }

        return totalMag > 0 ? Math.sqrt(sum / totalMag) : 0;
    }

    /**
     * Calculate zero-crossing rate
     */
    private calculateZeroCrossingRate(audioData: Float32Array): number {
        let crossings = 0;

        for (let i = 1; i < audioData.length; i++) {
            if ((audioData[i] >= 0 && audioData[i - 1] < 0) ||
                (audioData[i] < 0 && audioData[i - 1] >= 0)) {
                crossings++;
            }
        }

        return crossings / audioData.length;
    }

    /**
     * Calculate energy in different frequency bands
     */
    private calculateBandEnergies(fftData: number[], sampleRate: number): any {
        const binWidth = sampleRate / this.config.fftSize;
        
        let subBass = 0, bass = 0, lowMid = 0, mid = 0;
        let highMid = 0, presence = 0, brilliance = 0;

        for (let i = 0; i < fftData.length; i++) {
            const freq = i * binWidth;
            const energy = fftData[i] * fftData[i];

            if (freq < this.SUB_BASS_MAX) subBass += energy;
            else if (freq < this.BASS_MAX) bass += energy;
            else if (freq < this.LOW_MID_MAX) lowMid += energy;
            else if (freq < this.MID_MAX) mid += energy;
            else if (freq < this.HIGH_MID_MAX) highMid += energy;
            else if (freq < this.PRESENCE_MAX) presence += energy;
            else brilliance += energy;
        }

        // Normalize
        const total = subBass + bass + lowMid + mid + highMid + presence + brilliance + 1e-10;

        return {
            subBass: subBass / total,
            bass: bass / total,
            lowMid: lowMid / total,
            mid: mid / total,
            highMid: highMid / total,
            presence: presence / total,
            brilliance: brilliance / total,
            treble: (highMid + presence + brilliance) / total
        };
    }

    /**
     * Calculate global metrics across all sources
     */
    private calculateGlobalMetrics(elements: VisualElement[]): GlobalAudioMetrics {
        if (elements.length === 0) {
            return {
                overallVolume: 0,
                dominantFrequency: 0,
                spectralEnergy: [],
                numActiveSources: 0
            };
        }

        const overallVolume = elements.reduce((sum, e) => sum + e.amplitude, 0) / elements.length;
        
        // Find loudest element's frequency
        const loudest = elements.reduce((max, e) => e.amplitude > max.amplitude ? e : max, elements[0]);
        const dominantFrequency = loudest.frequency;

        // Aggregate spectral energy
        const spectralEnergy = new Array(this.config.freqBands).fill(0);
        
        return {
            overallVolume,
            dominantFrequency,
            spectralEnergy,
            numActiveSources: elements.length
        };
    }

    /**
     * Update visualization (called periodically)
     */
    private update(): void {
        if (this.currentFrame) {
            // Decay inactive sources
            this.currentFrame.elements = this.currentFrame.elements.filter(element => {
                const source = this.sources.get(element.sourceId);
                if (source) {
                    // Fade out inactive sources
                    if (!source.active) {
                        element.brightness *= 0.9;
                        return element.brightness > 0.01;
                    }
                    source.active = false; // Reset for next frame
                }
                return true;
            });

            this.emit('frameUpdate', this.currentFrame);
        }
    }

    /**
     * Get current visualization frame
     */
    public getCurrentFrame(): VisualizationFrame | null {
        return this.currentFrame;
    }

    /**
     * Get registered sources
     */
    public getSources(): AudioSource[] {
        return Array.from(this.sources.values());
    }

    /**
     * Set source position (for spatial audio visualization)
     */
    public setSourcePosition(sourceId: string, x: number, y: number, z: number): void {
        const source = this.sources.get(sourceId);
        if (source) {
            source.position = { x, y, z };
            this.emit('sourcePositionChanged', { sourceId, position: source.position });
        }
    }
}

export default AudioSwizzleVisualizer;

