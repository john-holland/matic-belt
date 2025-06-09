import { EventEmitter } from 'events';
import { MotionGraph } from './graph';
import { MIDIWriter } from './midi-writer';
import * as tf from '@tensorflow/tfjs';

interface DanceSequence {
    timestamp: number;
    motion: tf.Tensor;
    confidence: number;
    style: string;
}

interface DanceInterpolationConfig {
    sampleRate: number;
    maxDuration: number;
    styleWeights: { [key: string]: number };
    tempoRange: [number, number];
    keyRange: [number, number];
}

export class DanceInterpolator extends EventEmitter {
    private isRecording: boolean = false;
    private sequences: DanceSequence[] = [];
    private config: DanceInterpolationConfig;
    private motionGraph: MotionGraph;
    private midiWriter: MIDIWriter;
    private startTime: number = 0;

    constructor(config: Partial<DanceInterpolationConfig> = {}) {
        super();
        this.config = {
            sampleRate: 30, // 30 fps
            maxDuration: 300, // 5 minutes
            styleWeights: {
                'hip-hop': 1.0,
                'ballet': 1.0,
                'jazz': 1.0,
                'contemporary': 1.0
            },
            tempoRange: [60, 180], // BPM range
            keyRange: [0, 11], // MIDI note range
            ...config
        };
        this.motionGraph = new MotionGraph();
        this.midiWriter = new MIDIWriter();
    }

    public startRecording(): void {
        if (this.isRecording) return;
        
        this.isRecording = true;
        this.sequences = [];
        this.startTime = performance.now();
        this.emit('recordingStarted');
        
        // Start motion capture
        this.captureMotion();
    }

    public stopRecording(): void {
        if (!this.isRecording) return;
        
        this.isRecording = false;
        this.emit('recordingStopped');
        
        // Process and generate MIDI
        this.generateMIDI();
    }

    private async captureMotion(): Promise<void> {
        while (this.isRecording) {
            const currentTime = performance.now() - this.startTime;
            
            if (currentTime > this.config.maxDuration * 1000) {
                this.stopRecording();
                break;
            }

            // Capture motion data
            const motion = await this.motionGraph.getCurrentMotion();
            const style = this.detectDanceStyle(motion);
            const confidence = this.calculateConfidence(motion);

            this.sequences.push({
                timestamp: currentTime,
                motion,
                confidence,
                style
            });

            // Emit progress
            this.emit('motionCaptured', {
                timestamp: currentTime,
                style,
                confidence
            });

            // Wait for next frame
            await new Promise(resolve => 
                setTimeout(resolve, 1000 / this.config.sampleRate)
            );
        }
    }

    private detectDanceStyle(motion: tf.Tensor): string {
        // Analyze motion patterns to detect dance style
        const features = this.extractMotionFeatures(motion);
        const styleScores = this.calculateStyleScores(features);
        return this.selectDominantStyle(styleScores);
    }

    private extractMotionFeatures(motion: tf.Tensor): tf.Tensor {
        // Extract relevant features for style detection
        const velocity = tf.grad(motion);
        const acceleration = tf.grad(velocity);
        const jerk = tf.grad(acceleration);
        
        return tf.concat([
            motion,
            velocity,
            acceleration,
            jerk
        ]);
    }

    private calculateStyleScores(features: tf.Tensor): { [key: string]: number } {
        const scores: { [key: string]: number } = {};
        
        // Calculate style scores based on motion features
        for (const style of Object.keys(this.config.styleWeights)) {
            const stylePattern = this.getStylePattern(style);
            const similarity = this.calculateSimilarity(features, stylePattern);
            scores[style] = similarity * this.config.styleWeights[style];
        }
        
        return scores;
    }

    private selectDominantStyle(scores: { [key: string]: number }): string {
        return Object.entries(scores)
            .reduce((a, b) => a[1] > b[1] ? a : b)[0];
    }

    private calculateConfidence(motion: tf.Tensor): number {
        // Calculate confidence based on motion stability and style match
        const stability = this.calculateStability(motion);
        const styleMatch = this.calculateStyleMatch(motion);
        return (stability + styleMatch) / 2;
    }

    private calculateStability(motion: tf.Tensor): number {
        // Calculate motion stability
        const variance = tf.moments(motion).variance;
        return 1 / (1 + tf.mean(variance).dataSync()[0]);
    }

    private calculateStyleMatch(motion: tf.Tensor): number {
        // Calculate how well the motion matches the detected style
        const style = this.detectDanceStyle(motion);
        const stylePattern = this.getStylePattern(style);
        return this.calculateSimilarity(motion, stylePattern);
    }

    private calculateSimilarity(a: tf.Tensor, b: tf.Tensor): number {
        // Calculate cosine similarity between tensors
        const dotProduct = tf.sum(tf.mul(a, b));
        const normA = tf.norm(a);
        const normB = tf.norm(b);
        return dotProduct.div(normA.mul(normB)).dataSync()[0];
    }

    private getStylePattern(style: string): tf.Tensor {
        // Get the motion pattern template for a specific style
        // This would typically be loaded from a pre-trained model
        return tf.zeros([1]); // Placeholder
    }

    private async generateMIDI(): Promise<void> {
        // Process dance sequences into MIDI
        const midiSequence = this.sequences.map(seq => ({
            time: seq.timestamp / 1000, // Convert to seconds
            note: this.mapMotionToNote(seq.motion),
            velocity: this.mapConfidenceToVelocity(seq.confidence),
            duration: this.calculateNoteDuration(seq)
        }));

        // Generate MIDI file
        const midiData = await this.midiWriter.generateMIDI(midiSequence);
        
        // Emit the generated MIDI
        this.emit('midiGenerated', midiData);
    }

    private mapMotionToNote(motion: tf.Tensor): number {
        // Map motion intensity to MIDI note
        const intensity = tf.norm(motion).dataSync()[0];
        const noteRange = this.config.keyRange[1] - this.config.keyRange[0];
        return Math.floor(
            this.config.keyRange[0] + (intensity * noteRange)
        );
    }

    private mapConfidenceToVelocity(confidence: number): number {
        // Map confidence to MIDI velocity (0-127)
        return Math.floor(confidence * 127);
    }

    private calculateNoteDuration(sequence: DanceSequence): number {
        // Calculate note duration based on motion characteristics
        const motionSpeed = tf.norm(
            tf.grad(sequence.motion)
        ).dataSync()[0];
        
        // Faster motion = shorter notes
        return 0.5 / (1 + motionSpeed);
    }

    public getAnalysis(): string {
        // Generate a musical analysis of the dance
        const styles = this.sequences.map(s => s.style);
        const dominantStyle = this.findDominantStyle(styles);
        const tempo = this.calculateAverageTempo();
        const key = this.determineKey();

        return `
Dance Analysis:
- Dominant Style: ${dominantStyle}
- Average Tempo: ${tempo} BPM
- Musical Key: ${key}
- Duration: ${(this.sequences[this.sequences.length - 1]?.timestamp || 0) / 1000}s
- Style Transitions: ${this.countStyleTransitions(styles)}
- Motion Complexity: ${this.calculateMotionComplexity()}
        `.trim();
    }

    private findDominantStyle(styles: string[]): string {
        const counts = styles.reduce((acc, style) => {
            acc[style] = (acc[style] || 0) + 1;
            return acc;
        }, {} as { [key: string]: number });

        return Object.entries(counts)
            .reduce((a, b) => a[1] > b[1] ? a : b)[0];
    }

    private calculateAverageTempo(): number {
        const intervals = this.sequences
            .slice(1)
            .map((seq, i) => seq.timestamp - this.sequences[i].timestamp);
        
        const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
        return Math.round(60000 / avgInterval); // Convert to BPM
    }

    private determineKey(): string {
        const notes = this.sequences.map(seq => 
            this.mapMotionToNote(seq.motion)
        );
        
        // Simple key detection based on most common notes
        const noteCounts = notes.reduce((acc, note) => {
            acc[note % 12] = (acc[note % 12] || 0) + 1;
            return acc;
        }, {} as { [key: number]: number });

        const rootNote = Object.entries(noteCounts)
            .reduce((a, b) => a[1] > b[1] ? a : b)[0];

        const keyNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
        return keyNames[parseInt(rootNote)];
    }

    private countStyleTransitions(styles: string[]): number {
        return styles.slice(1)
            .filter((style, i) => style !== styles[i])
            .length;
    }

    private calculateMotionComplexity(): string {
        const complexities = this.sequences.map(seq => 
            tf.norm(tf.grad(seq.motion)).dataSync()[0]
        );
        
        const avgComplexity = complexities.reduce((a, b) => a + b, 0) / complexities.length;
        
        if (avgComplexity < 0.3) return 'Low';
        if (avgComplexity < 0.7) return 'Medium';
        return 'High';
    }
} 