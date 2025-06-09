import * as tf from '@tensorflow/tfjs-node';
import { AudioFeatures } from './analyzer.d';

export interface PhoneticInterpretation {
    syllables: string[];
    joyScore: number;
    dorsalStream: number[];
    ventralStream: number[];
}

export class RNNModel {
    private readonly SEQUENCE_LENGTH = 50;
    private readonly HIDDEN_SIZE = 128;
    private dorsalModel!: tf.Sequential;
    private ventralModel!: tf.Sequential;
    private phoneticModel!: tf.Sequential;

    constructor() {
        this.initializeModels();
    }

    private initializeModels(): void {
        // Dorsal stream (temporal processing)
        this.dorsalModel = tf.sequential();
        this.dorsalModel.add(tf.layers.lstm({
            units: this.HIDDEN_SIZE,
            returnSequences: true,
            inputShape: [this.SEQUENCE_LENGTH, 1]
        }));
        this.dorsalModel.add(tf.layers.dropout({ rate: 0.2 }));
        this.dorsalModel.add(tf.layers.lstm({
            units: this.HIDDEN_SIZE,
            returnSequences: false
        }));

        // Ventral stream (feature processing)
        this.ventralModel = tf.sequential();
        this.ventralModel.add(tf.layers.conv1d({
            filters: 32,
            kernelSize: 3,
            activation: 'relu',
            inputShape: [this.SEQUENCE_LENGTH, 1]
        }));
        this.ventralModel.add(tf.layers.maxPooling1d({ poolSize: 2 }));
        this.ventralModel.add(tf.layers.conv1d({
            filters: 64,
            kernelSize: 3,
            activation: 'relu'
        }));
        this.ventralModel.add(tf.layers.globalAveragePooling1d());

        // Phonetic model (combines dorsal and ventral streams)
        this.phoneticModel = tf.sequential();
        this.phoneticModel.add(tf.layers.dense({
            units: this.HIDDEN_SIZE,
            activation: 'relu',
            inputShape: [this.HIDDEN_SIZE * 2]
        }));
        this.phoneticModel.add(tf.layers.dropout({ rate: 0.2 }));
        this.phoneticModel.add(tf.layers.dense({
            units: 26, // Number of phonemes
            activation: 'softmax'
        }));
    }

    async predictPhonetics(
        messages: string[],
        features?: (AudioFeatures | undefined)[]
    ): Promise<PhoneticInterpretation> {
        // Convert messages to tensor
        const messageTensor = this.textToTensor(messages);
        
        // Get dorsal stream predictions
        const dorsalOutput = this.dorsalModel.predict(messageTensor) as tf.Tensor;
        
        // Get ventral stream predictions
        const ventralOutput = this.ventralModel.predict(messageTensor) as tf.Tensor;
        
        // Combine streams
        const combinedOutput = tf.concat([dorsalOutput, ventralOutput], 1);
        
        // Get phonetic predictions
        const phoneticOutput = this.phoneticModel.predict(combinedOutput) as tf.Tensor;
        
        // Convert predictions to phonetics
        const phonetics = await this.tensorToPhonetics(phoneticOutput);
        
        // Calculate joy score
        const joyScore = this.calculateJoyScore(phonetics);
        
        return {
            syllables: this.formSyllables(phonetics),
            joyScore,
            dorsalStream: await dorsalOutput.array() as number[],
            ventralStream: await ventralOutput.array() as number[]
        };
    }

    private textToTensor(messages: string[]): tf.Tensor {
        // Convert text to numerical representation
        const sequence = messages.join(' ')
            .split('')
            .map(char => char.charCodeAt(0) / 255)
            .slice(0, this.SEQUENCE_LENGTH);
        
        // Pad sequence if necessary
        while (sequence.length < this.SEQUENCE_LENGTH) {
            sequence.push(0);
        }
        
        return tf.tensor2d([sequence], [1, this.SEQUENCE_LENGTH]);
    }

    private async tensorToPhonetics(tensor: tf.Tensor): Promise<string[]> {
        const probs = await tensor.array() as number[][];
        return probs[0].map((prob, i) => {
            const phoneme = this.indexToPhoneme(i);
            return { phoneme, probability: prob };
        })
        .filter(p => p.probability > 0.1)
        .map(p => p.phoneme);
    }

    private indexToPhoneme(index: number): string {
        const phonemes = 'abcdefghijklmnopqrstuvwxyz'.split('');
        return phonemes[index] || '';
    }

    private formSyllables(phonetics: string[]): string[] {
        const syllables: string[] = [];
        let currentSyllable = '';
        
        for (const phoneme of phonetics) {
            if (this.isVowel(phoneme)) {
                currentSyllable += phoneme;
                if (currentSyllable) {
                    syllables.push(currentSyllable);
                    currentSyllable = '';
                }
            } else {
                currentSyllable += phoneme;
            }
        }
        
        if (currentSyllable) {
            syllables.push(currentSyllable);
        }
        
        return syllables;
    }

    private isVowel(phoneme: string): boolean {
        return 'aeiou'.includes(phoneme);
    }

    private calculateJoyScore(phonetics: string[]): number {
        // Simplified joy score calculation based on phonetic patterns
        const vowelCount = phonetics.filter(p => this.isVowel(p)).length;
        const consonantCount = phonetics.length - vowelCount;
        return Math.min(1, (vowelCount / (consonantCount + 1)) * 0.5 + 0.5);
    }
} 