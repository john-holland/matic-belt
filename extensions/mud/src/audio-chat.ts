import { EventEmitter } from 'events';

// Optional types - stubbed if modules don't exist
export interface AudioFeatures {
    mode?: string;
    key?: string;
    tempo?: number;
    chorusDetected?: boolean;
    notes?: string[];
    harmonicComplexity?: number;
}

export interface PhoneticInterpretation {
    syllables: string[];
    joyScore: number;
}

export interface AudioChatMessage {
    type: 'system' | 'user' | 'analysis' | 'phonetic' | 'joy';
    content: string;
    timestamp: number;
    sender: string;
    data?: {
        features?: AudioFeatures;
        interpretation?: PhoneticInterpretation;
        midi?: any;
    };
}

export class AudioChat extends EventEmitter {
    private recentMessages: AudioChatMessage[] = [];
    private readonly MAX_MESSAGES = 100;

    constructor() {
        super();
        // Audio analyzer and RNN model are optional dependencies
        // They can be initialized later if the modules are available
    }

    async handleMessage(userId: string, content: string): Promise<void> {
        try {
            // Add user message to history
            const userMessage: AudioChatMessage = {
                type: 'user',
                content,
                timestamp: Date.now(),
                sender: userId
            };
            this.addMessage(userMessage);

            // Check if this is a request for audio analysis
            if (content.toLowerCase().includes("what's worth hearing")) {
                await this.analyzeRecentAudio(userId);
            }

            // Check for MIDI-related commands
            if (content.toLowerCase().includes('midi')) {
                await this.handleMidiCommand(userId, content);
            }

            // Generate phonetic interpretation (stubbed if RNN model not available)
            const interpretation: PhoneticInterpretation = {
                syllables: content.split(' '),
                joyScore: 0.5
            };

            // Emit phonetic interpretation
            const phoneticMessage: AudioChatMessage = {
                type: 'phonetic',
                content: interpretation.syllables.join(' '),
                timestamp: Date.now(),
                sender: 'system',
                data: { interpretation }
            };
            this.addMessage(phoneticMessage);
            this.emit('message', phoneticMessage);

            // Calculate and emit joy score
            const joyMessage: AudioChatMessage = {
                type: 'joy',
                content: `Collective joy score: ${interpretation.joyScore.toFixed(2)}`,
                timestamp: Date.now(),
                sender: 'system'
            };
            this.addMessage(joyMessage);
            this.emit('message', joyMessage);

        } catch (error) {
            console.error('Error handling audio chat message:', error);
            const errorMessage: AudioChatMessage = {
                type: 'system',
                content: 'Failed to process audio analysis request',
                timestamp: Date.now(),
                sender: 'system'
            };
            this.addMessage(errorMessage);
            this.emit('message', errorMessage);
        }
    }

    private async analyzeRecentAudio(userId: string): Promise<void> {
        try {
            // Stub audio features (analyzer not available)
            const features: AudioFeatures = {
                mode: 'unknown',
                key: 'C',
                tempo: 120,
                chorusDetected: false,
                notes: [],
                harmonicComplexity: 0.5
            };

            // Create analysis message
            const analysisMessage: AudioChatMessage = {
                type: 'analysis',
                content: this.formatAnalysisMessage(features),
                timestamp: Date.now(),
                sender: 'system',
                data: { features }
            };

            this.addMessage(analysisMessage);
            this.emit('message', analysisMessage);

        } catch (error) {
            console.error('Error analyzing recent audio:', error);
            throw error;
        }
    }

    private async handleMidiCommand(userId: string, content: string): Promise<void> {
        try {
            // Stub MIDI generation (analyzer not available)
            const midiMessage: AudioChatMessage = {
                type: 'system',
                content: 'MIDI generation not available (optional dependency missing)',
                timestamp: Date.now(),
                sender: 'system'
            };

            this.addMessage(midiMessage);
            this.emit('message', midiMessage);

        } catch (error) {
            console.error('Error handling MIDI command:', error);
            throw error;
        }
    }

    private formatAnalysisMessage(features: AudioFeatures): string {
        return `
🎵 Audio Analysis:
• Detected Mode: ${features.mode}
• Key: ${features.key}
• Tempo: ${features.tempo} BPM
• Chorus Detected: ${features.chorusDetected ? 'Yes' : 'No'}
• Musical Notes: ${features.notes.join(', ')}
• Harmonic Complexity: ${features.harmonicComplexity}
        `.trim();
    }

    private addMessage(message: AudioChatMessage): void {
        this.recentMessages.push(message);
        if (this.recentMessages.length > this.MAX_MESSAGES) {
            this.recentMessages.shift();
        }
    }
} 