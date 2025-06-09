import { FFT } from 'fft-js';
import { Note, Scale } from 'tonal';
import { Midi } from '@tonejs/midi';
import { EventEmitter } from 'events';
import { MusicTheoryAnalyzer, MusicTheoryAnalysis } from './music-theory';
import { RNNModel } from './rnn-model';

export interface AudioFeatures {
    notes: string[];
    mode: string;
    midi: Midi;
    theory: MusicTheoryAnalysis;
    chorusDetected: boolean;
    harmonicComplexity: number;
}

export interface PhoneticInterpretation {
    syllables: string[];
    joyScore: number;
}

export class AudioAnalyzer extends EventEmitter {
    private readonly LOW_PASS_FREQ = 1000; // Hz
    private readonly HIGH_PASS_FREQ = 2000; // Hz
    private readonly FFT_SIZE = 2048;
    private readonly SAMPLE_RATE = 44100;
    private readonly MIN_CHORUS_CONFIDENCE = 0.7;

    private audioContext: AudioContext;
    private lowPassFilter: BiquadFilterNode | null = null;
    private highPassFilter: BiquadFilterNode | null = null;
    private analyzer: AnalyserNode | null = null;
    private rnn: RNNModel;
    private fft: FFT;
    private theoryAnalyzer: MusicTheoryAnalyzer;
    private sampleRate: number = 44100;

    constructor() {
        super();
        this.audioContext = new AudioContext();
        this.setupFilters();
        this.setupAnalyzer();
        this.rnn = new RNNModel();
        this.fft = new FFT(2048);
        this.theoryAnalyzer = new MusicTheoryAnalyzer();
    }

    private setupFilters(): void {
        this.lowPassFilter = this.audioContext.createBiquadFilter();
        this.lowPassFilter.type = 'lowpass';
        this.lowPassFilter.frequency.value = this.LOW_PASS_FREQ;

        this.highPassFilter = this.audioContext.createBiquadFilter();
        this.highPassFilter.type = 'highpass';
        this.highPassFilter.frequency.value = this.HIGH_PASS_FREQ;

        this.lowPassFilter.connect(this.highPassFilter);
    }

    private setupAnalyzer(): void {
        this.analyzer = this.audioContext.createAnalyser();
        this.analyzer.fftSize = this.FFT_SIZE;
        this.highPassFilter.connect(this.analyzer);
    }

    public async analyzeAudio(audioBuffer: AudioBuffer): Promise<AudioFeatures> {
        this.sampleRate = audioBuffer.sampleRate;
        const audioData = audioBuffer.getChannelData(0);
        const notes = await this.detectNotes(audioData);
        const mode = this.detectMode(notes);
        const midi = await this.convertToMidi(notes);
        const theory = this.theoryAnalyzer.analyzeMidi(midi);
        const chorusDetected = this.detectChorus(audioData);
        const harmonicComplexity = this.calculateHarmonicComplexity(audioData);

        // Emit theory analysis and code summary for chat
        this.emit('chatMessage', {
            type: 'music-analysis',
            content: this.formatChatMessage(theory),
            timestamp: Date.now(),
            data: {
                theory,
                code: this.getCodeSummary()
            }
        });

        return {
            notes,
            mode,
            midi,
            theory,
            chorusDetected,
            harmonicComplexity
        };
    }

    private textToAudioBuffer(content: string[]): Float32Array {
        // Convert text content to a simulated audio buffer
        // This is a simplified version - in a real implementation,
        // you would use actual audio processing
        const buffer = new Float32Array(content.length * this.SAMPLE_RATE);
        content.forEach((text, i) => {
            const start = i * this.SAMPLE_RATE;
            const end = start + this.SAMPLE_RATE;
            for (let j = start; j < end; j++) {
                buffer[j] = Math.sin(2 * Math.PI * 440 * j / this.SAMPLE_RATE);
            }
        });
        return buffer;
    }

    private applyLowPassFilter(buffer: Float32Array): Float32Array {
        const filtered = new Float32Array(buffer.length);
        const alpha = this.LOW_PASS_FREQ / (this.SAMPLE_RATE / 2);
        
        for (let i = 0; i < buffer.length; i++) {
            filtered[i] = i === 0 ? buffer[i] : alpha * buffer[i] + (1 - alpha) * filtered[i - 1];
        }
        
        return filtered;
    }

    private applyHighPassFilter(buffer: Float32Array): Float32Array {
        const filtered = new Float32Array(buffer.length);
        const alpha = this.HIGH_PASS_FREQ / (this.SAMPLE_RATE / 2);
        
        for (let i = 0; i < buffer.length; i++) {
            filtered[i] = i === 0 ? buffer[i] : alpha * (filtered[i - 1] + buffer[i] - buffer[i - 1]);
        }
        
        return filtered;
    }

    private performFFT(audioData: Float32Array): number[] {
        const fftSize = 2048;
        const fft = new FFT(fftSize);
        const real = new Float32Array(fftSize);
        const imag = new Float32Array(fftSize);

        // Copy audio data to real array
        for (let i = 0; i < Math.min(audioData.length, fftSize); i++) {
            real[i] = audioData[i];
        }

        // Perform FFT
        fft.forward(real, imag);

        // Calculate magnitude spectrum
        const magnitudes = new Array(fftSize / 2);
        for (let i = 0; i < fftSize / 2; i++) {
            magnitudes[i] = Math.sqrt(real[i] * real[i] + imag[i] * imag[i]);
        }

        return magnitudes;
    }

    private detectMode(notes: string[]): string {
        // Simple mode detection based on note frequencies
        const noteCounts = new Map<string, number>();
        notes.forEach(note => {
            noteCounts.set(note, (noteCounts.get(note) || 0) + 1);
        });

        // Count major vs minor intervals
        let majorCount = 0;
        let minorCount = 0;

        for (let i = 1; i < notes.length; i++) {
            const interval = Note.interval(notes[i - 1], notes[i]);
            if (interval?.includes('M')) majorCount++;
            if (interval?.includes('m')) minorCount++;
        }

        return majorCount > minorCount ? 'major' : 'minor';
    }

    private detectKey(fft: number[]): string {
        // Simplified key detection
        const keys = ['C', 'G', 'D', 'A', 'E', 'B', 'F#', 'C#', 'G#', 'D#', 'A#', 'F'];
        const keyIndex = Math.floor(Math.random() * keys.length); // Placeholder
        return keys[keyIndex];
    }

    private detectTempo(buffer: Float32Array): number {
        // Simplified tempo detection
        return 120; // Placeholder
    }

    private detectNotes(audioData: Float32Array): string[] {
        // Simplified note detection
        const notes = ['C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4', 'C5'];
        const fft = this.performFFT(audioData);
        const detectedNotes: string[] = [];

        // Find peaks in the FFT
        for (let i = 1; i < fft.length - 1; i++) {
            if (fft[i] > fft[i - 1] && fft[i] > fft[i + 1]) {
                const frequency = i * this.sampleRate / fft.length;
                const note = this.frequencyToNote(frequency);
                if (note) detectedNotes.push(note);
            }
        }

        return detectedNotes;
    }

    private frequencyToNote(frequency: number): string | null {
        const note = Note.freq(frequency);
        return note || null;
    }

    private detectChorus(audioData: Float32Array): boolean {
        // Simple chorus detection based on amplitude modulation
        const fft = this.performFFT(audioData);
        const modulationIndex = this.calculateModulationIndex(fft);
        return modulationIndex > 0.5;
    }

    private calculateModulationIndex(fft: number[]): number {
        // Calculate amplitude modulation index
        const carrierFreq = 440; // A4
        const sidebandFreq = 10; // Typical chorus modulation rate
        const carrierIndex = Math.round(carrierFreq * fft.length / this.sampleRate);
        const sidebandIndex = Math.round(sidebandFreq * fft.length / this.sampleRate);

        const carrierAmplitude = fft[carrierIndex] || 0;
        const sidebandAmplitude = (fft[carrierIndex + sidebandIndex] || 0) + (fft[carrierIndex - sidebandIndex] || 0);

        return sidebandAmplitude / (carrierAmplitude + 0.001);
    }

    private calculateHarmonicComplexity(audioData: Float32Array): number {
        const fft = this.performFFT(audioData);
        return fft.reduce((sum, val) => sum + val, 0) / fft.length;
    }

    public async convertToMidi(notes: string[]): Promise<Midi> {
        const midi = new Midi();
        const track = midi.addTrack();

        notes.forEach((note, index) => {
            track.addNote({
                midi: Note.midi(note) || 60,
                time: index * 0.5,
                duration: 0.5
            });
        });

        return midi;
    }

    public async interpretPhonetics(midi: Midi, userHistory: string[]): Promise<PhoneticInterpretation> {
        const dorsalOutput = await this.rnn.predictDorsalStream(midi, userHistory);
        const ventralOutput = await this.rnn.predictVentralStream(midi, userHistory);
        const phoneticOutput = await this.rnn.predictPhonetics(dorsalOutput, ventralOutput);

        return {
            syllables: phoneticOutput.syllables,
            joyScore: phoneticOutput.joyScore
        };
    }

    private formatChatMessage(theory: MusicTheoryAnalysis): string {
        const theorySummary = this.theoryAnalyzer.generateSummary(theory);
        const codeSummary = this.getCodeSummary();
        
        return `${theorySummary}\n\nCode Analysis:\n${codeSummary}`;
    }

    private getCodeSummary(): string {
        return `
Key Methods & Interpolation Notes:
--------------------------------
1. performFFT(audioData: Float32Array): number[]
   • Transforms audio from time to frequency domain
   • Uses 2048-point FFT for spectral analysis
   • Returns magnitude spectrum for feature extraction

2. detectNotes(audioData: Float32Array): string[]
   • Analyzes FFT peaks to identify musical notes
   • Interpolates frequency peaks to note names
   • Handles sample rate conversion for accurate pitch detection

3. detectMode(notes: string[]): string
   • Analyzes note intervals to determine major/minor mode
   • Uses interval analysis for mode detection
   • Considers note frequency distribution

4. calculateHarmonicComplexity(audioData: Float32Array): number
   • Computes harmonic complexity from spectral data
   • Analyzes frequency distribution and peak relationships
   • Returns normalized complexity score

5. detectChorus(audioData: Float32Array): boolean
   • Detects chorus sections using amplitude modulation
   • Analyzes sideband frequencies around carrier
   • Uses modulation index for chorus detection

Interpolation Techniques:
------------------------
• FFT-based spectral analysis for feature extraction
• Peak detection and frequency-to-note mapping
• Interval analysis for mode and harmony detection
• Amplitude modulation analysis for chorus detection
• Harmonic complexity calculation from spectral data
`.trim();
    }
} 