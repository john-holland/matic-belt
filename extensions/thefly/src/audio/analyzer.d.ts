import { Midi } from '@tonejs/midi';

export interface AudioFeatures {
    mode: string;
    key: string;
    tempo: number;
    chorusDetected: boolean;
    notes: string[];
    harmonicComplexity: number;
}

export interface PhoneticInterpretation {
    syllables: string[];
    joyScore: number;
    dorsalStream: number[];
    ventralStream: number[];
}

export class AudioAnalyzer {
    constructor();
    analyzeAudio(content: string[]): Promise<AudioFeatures>;
    convertToMidi(content: string[]): Promise<Midi>;
} 