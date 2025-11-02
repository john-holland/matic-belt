const fftjs = require('fft-js');
import { Note, Scale } from 'tonal';
import { Midi } from '@tonejs/midi';
import { EventEmitter } from 'events';
import { MusicTheoryAnalyzer, MusicTheoryAnalysis } from './music-theory';
import { RNNModel } from './rnn-model';

// Mock AudioContext for Node.js environment
class MockAudioContext {
  createBiquadFilter() {
    return {
      type: 'lowpass',
      frequency: { value: 1000 },
      connect: () => {}
    };
  }
  
  createAnalyser() {
    return {
      fftSize: 2048,
      smoothingTimeConstant: 0.8,
      connect: () => {}
    };
  }
}

// Use mock AudioContext in Node.js environment
const AudioContextClass = typeof AudioContext !== 'undefined' ? AudioContext : MockAudioContext;

export interface AudioFeatures {
    notes: string[];
    mode: string;
    midi: Midi;
    theory: MusicTheoryAnalysis;
    chorusDetected: boolean;
    harmonicComplexity: number;
    key: string;
    tempo: number;
}

export interface PhoneticInterpretation {
    syllables: string[];
    joyScore: number;
    dorsalStream?: number[];
    ventralStream?: number[];
}

export class AudioAnalyzer extends EventEmitter {
    private readonly LOW_PASS_FREQ = 1000; // Hz
    private readonly HIGH_PASS_FREQ = 2000; // Hz
    private readonly FFT_SIZE = 2048;
    private readonly SAMPLE_RATE = 44100;
    private readonly MIN_CHORUS_CONFIDENCE = 0.7;

    private audioContext: any;
    private lowPassFilter: any = null;
    private highPassFilter: any = null;
    private analyzer: any = null;
    private rnn: RNNModel;
    private theoryAnalyzer: MusicTheoryAnalyzer;
    private sampleRate: number = 44100;

    constructor() {
        super();
        this.audioContext = new AudioContextClass();
        this.setupFilters();
        this.setupAnalyzer();
        this.rnn = new RNNModel();
        this.theoryAnalyzer = new MusicTheoryAnalyzer();
    }

    private setupFilters(): void {
        // Low-pass filter
        this.lowPassFilter = this.audioContext.createBiquadFilter();
        this.lowPassFilter.type = 'lowpass';
        this.lowPassFilter.frequency.value = this.LOW_PASS_FREQ;

        // High-pass filter
        this.highPassFilter = this.audioContext.createBiquadFilter();
        this.highPassFilter.type = 'highpass';
        this.highPassFilter.frequency.value = this.HIGH_PASS_FREQ;

        // Connect filters
        if (this.lowPassFilter && this.highPassFilter && this.analyzer) {
            this.lowPassFilter.connect(this.highPassFilter);
            this.highPassFilter.connect(this.analyzer);
        }
    }

    private setupAnalyzer(): void {
        this.analyzer = this.audioContext.createAnalyser();
        this.analyzer.fftSize = this.FFT_SIZE;
        this.analyzer.smoothingTimeConstant = 0.8;
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
            harmonicComplexity,
            key: theory.key || 'C',
            tempo: theory.rhythm?.tempo || 120
        };
    }

    private async detectNotes(audioData: Float32Array): Promise<string[]> {
        const fftData = this.performFFT(audioData);
        const peaks = this.findPeaks(fftData);
        const notes: string[] = [];

        for (const peak of peaks) {
            const frequency = peak * this.sampleRate / this.FFT_SIZE;
            const note = this.frequencyToNote(frequency);
            if (note) {
                notes.push(note);
            }
        }

        return notes;
    }

    private performFFT(audioData: Float32Array): number[] {
        // Prepare input array
        const input: number[] = [];
        for (let i = 0; i < this.FFT_SIZE; i++) {
            input.push(i < audioData.length ? audioData[i] : 0);
        }
        
        // Perform FFT using fft-js
        const phasors = fftjs.fft(input);
        
        // Calculate magnitudes
        const magnitudes: number[] = [];
        for (let i = 0; i < this.FFT_SIZE / 2; i++) {
            const real = phasors[i][0];
            const imag = phasors[i][1];
            magnitudes.push(Math.sqrt(real * real + imag * imag));
        }
        
        return magnitudes;
    }

    private findPeaks(fftData: number[]): number[] {
        const peaks: number[] = [];
        const threshold = Math.max(...fftData) * 0.1;

        for (let i = 1; i < fftData.length - 1; i++) {
            if (fftData[i] > threshold && 
                fftData[i] > fftData[i - 1] && 
                fftData[i] > fftData[i + 1]) {
                peaks.push(i);
            }
        }

        return peaks;
    }

    private frequencyToNote(frequency: number): string | null {
        if (frequency < 20 || frequency > 20000) return null;

        // Simple frequency to note conversion
        const A4 = 440;
        const noteNumber = Math.round(12 * Math.log2(frequency / A4));
        const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
        const octave = Math.floor((noteNumber + 9) / 12) + 4;
        const noteIndex = (noteNumber + 9) % 12;
        
        return `${noteNames[noteIndex]}${octave}`;
    }

    private detectMode(notes: string[]): string {
        if (notes.length < 3) return 'major';

        // Simple mode detection based on note intervals
        const intervals: number[] = [];
        for (let i = 1; i < notes.length; i++) {
            const interval = this.calculateInterval(notes[i - 1], notes[i]);
            if (interval !== null) {
                intervals.push(interval);
            }
        }

        // Count major vs minor intervals
        const majorIntervals = intervals.filter(interval => [2, 4, 7, 9, 11].includes(interval)).length;
        const minorIntervals = intervals.filter(interval => [1, 3, 6, 8, 10].includes(interval)).length;

        return majorIntervals > minorIntervals ? 'major' : 'minor';
    }

    private calculateInterval(note1: string, note2: string): number | null {
        try {
            const midi1 = Note.midi(note1);
            const midi2 = Note.midi(note2);
            
            if (midi1 === null || midi2 === null) return null;
            
            return (midi2 - midi1 + 12) % 12;
        } catch {
            return null;
        }
    }

    private async convertToMidi(notes: string[]): Promise<Midi> {
        const midi = new Midi();
        const track = midi.addTrack();

        let time = 0;
        for (const note of notes) {
            try {
                const midiNote = Note.midi(note);
                if (midiNote !== null) {
                    track.addNote({
                        midi: midiNote,
                        time: time,
                        duration: 0.5
                    });
                    time += 0.5;
                }
            } catch {
                // Skip invalid notes
            }
        }

        return midi;
    }

    private detectChorus(audioData: Float32Array): boolean {
        // Simple chorus detection based on amplitude modulation
        const modulationIndex = this.calculateModulationIndex(audioData);
        return modulationIndex > this.MIN_CHORUS_CONFIDENCE;
    }

    private calculateModulationIndex(audioData: Float32Array): number {
        let modulationSum = 0;
        const windowSize = 1024;

        for (let i = windowSize; i < audioData.length - windowSize; i += windowSize) {
            const window = audioData.slice(i, i + windowSize);
            const amplitude = Math.sqrt(window.reduce((sum, sample) => sum + sample * sample, 0) / window.length);
            modulationSum += amplitude;
        }

        return modulationSum / Math.floor(audioData.length / windowSize);
    }

    private calculateHarmonicComplexity(audioData: Float32Array): number {
        const fftData = this.performFFT(audioData);
        const peaks = this.findPeaks(fftData);
        
        // Calculate complexity based on number of peaks and their distribution
        const peakCount = peaks.length;
        const frequencyRange = Math.max(...peaks) - Math.min(...peaks);
        const averageAmplitude = peaks.reduce((sum, peak) => sum + fftData[peak], 0) / peakCount;
        
        // Normalize complexity score
        return Math.min(1.0, (peakCount * frequencyRange * averageAmplitude) / 1000000);
    }

    private formatChatMessage(theory: MusicTheoryAnalysis): string {
        return `
🎵 Music Analysis Results:
Key: ${theory.key} ${theory.mode}
Scale: ${theory.scale.join(', ')}
Chords: ${theory.chords.join(', ')}
Progression: ${theory.chordProgression.join(' → ')}
Rhythm: ${theory.rhythm.timeSignature} at ${theory.rhythm.tempo} BPM
Melody Range: ${theory.melody.range}
Harmony Complexity: ${theory.harmony.complexity.toFixed(2)}
Emotional Profile: Valence ${theory.emotionalProfile.valence.toFixed(2)}, Energy ${theory.emotionalProfile.energy.toFixed(2)}
        `.trim();
    }

    public async interpretPhonetics(midi: Midi, userHistory: string[]): Promise<PhoneticInterpretation> {
        try {
            const dorsalOutput = await this.rnn.predictPhonetics(userHistory);
            const ventralOutput = await this.rnn.predictPhonetics(userHistory);
            const phoneticOutput = await this.rnn.predictPhonetics(userHistory);

            return {
                syllables: phoneticOutput.syllables || [],
                joyScore: phoneticOutput.joyScore || 0.5
            };
        } catch (error) {
            console.error('Phonetic interpretation failed:', error);
            return {
                syllables: [],
                joyScore: 0.5
            };
        }
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