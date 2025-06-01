import { MemoryRegion, MemoryPattern, Anomaly } from './types';
import * as tf from '@tensorflow/tfjs-node';
import { HoughTransform } from './houghTransform';

export class PatternRecognizer {
    private model: tf.LayersModel;
    private houghTransform: HoughTransform;
    private patterns: MemoryPattern[] = [];
    private anomalies: Anomaly[] = [];
    private sequenceLength: number = 100;
    private confidenceThreshold: number = 0.8;

    constructor() {
        this.houghTransform = new HoughTransform();
        this.initializeModel();
    }

    private async initializeModel(): Promise<void> {
        // Create a simple RNN model for sequence prediction
        this.model = tf.sequential();
        
        // Add LSTM layer
        this.model.add(tf.layers.lstm({
            units: 64,
            returnSequences: true,
            inputShape: [this.sequenceLength, 2] // [sequence_length, features]
        }));

        // Add dense layer for prediction
        this.model.add(tf.layers.dense({
            units: 2,
            activation: 'linear'
        }));

        // Compile model
        this.model.compile({
            optimizer: tf.train.adam(0.001),
            loss: 'meanSquaredError'
        });
    }

    public async analyze(memoryInfo: MemoryRegion[]): Promise<MemoryPattern[]> {
        // Prepare data for analysis
        const sequences = this.prepareSequences(memoryInfo);
        
        // Detect patterns using RNN
        const rnnPatterns = await this.detectRNNPatterns(sequences);
        
        // Detect patterns using Hough transform
        const houghPatterns = this.detectHoughPatterns(memoryInfo);
        
        // Combine and deduplicate patterns
        this.patterns = this.combinePatterns(rnnPatterns, houghPatterns);
        
        // Detect anomalies
        this.anomalies = this.detectAnomalies(this.patterns);
        
        return this.patterns;
    }

    private prepareSequences(memoryInfo: MemoryRegion[]): tf.Tensor {
        // Convert memory regions to sequences of [address, size] pairs
        const sequences = memoryInfo.map(region => [
            region.normalizedAddress || 0,
            region.normalizedSize || 0
        ]);

        // Pad or truncate to sequence length
        while (sequences.length < this.sequenceLength) {
            sequences.push([0, 0]);
        }
        if (sequences.length > this.sequenceLength) {
            sequences.length = this.sequenceLength;
        }

        // Convert to tensor
        return tf.tensor2d(sequences);
    }

    private async detectRNNPatterns(sequences: tf.Tensor): Promise<MemoryPattern[]> {
        const patterns: MemoryPattern[] = [];
        
        try {
            // Make prediction
            const prediction = this.model.predict(sequences) as tf.Tensor;
            const predictedValues = await prediction.array() as number[][];
            
            // Calculate confidence based on prediction error
            const error = tf.sub(sequences, prediction).abs().mean().arraySync() as number;
            const confidence = Math.max(0, 1 - error);
            
            if (confidence > this.confidenceThreshold) {
                patterns.push({
                    type: this.determinePatternType(predictedValues),
                    confidence,
                    regions: [], // Will be filled by Hough transform
                    metadata: {
                        period: this.calculatePeriod(predictedValues),
                        entropy: this.calculateEntropy(predictedValues),
                        correlation: this.calculateCorrelation(predictedValues)
                    }
                });
            }
        } catch (error) {
            console.error('RNN pattern detection failed:', error);
        }
        
        return patterns;
    }

    private detectHoughPatterns(memoryInfo: MemoryRegion[]): MemoryPattern[] {
        // Convert memory regions to points for Hough transform
        const points = memoryInfo.map(region => ({
            x: region.normalizedAddress || 0,
            y: region.normalizedSize || 0
        }));

        // Detect lines and patterns
        const lines = this.houghTransform.detectLines(points);
        
        // Convert detected lines to patterns
        return lines.map(line => ({
            type: this.determinePatternTypeFromLine(line),
            confidence: line.confidence,
            regions: this.findRegionsInLine(memoryInfo, line),
            metadata: {
                period: line.period,
                entropy: this.calculateEntropyForLine(line),
                correlation: line.correlation
            }
        }));
    }

    private combinePatterns(rnnPatterns: MemoryPattern[], houghPatterns: MemoryPattern[]): MemoryPattern[] {
        const combined: MemoryPattern[] = [];
        const seen = new Set<string>();

        // Helper function to generate pattern key
        const getPatternKey = (pattern: MemoryPattern) => 
            `${pattern.type}-${pattern.regions.length}-${pattern.metadata?.period}`;

        // Add RNN patterns
        rnnPatterns.forEach(pattern => {
            const key = getPatternKey(pattern);
            if (!seen.has(key)) {
                seen.add(key);
                combined.push(pattern);
            }
        });

        // Add Hough patterns
        houghPatterns.forEach(pattern => {
            const key = getPatternKey(pattern);
            if (!seen.has(key)) {
                seen.add(key);
                combined.push(pattern);
            }
        });

        return combined;
    }

    private determinePatternType(values: number[][]): 'sequential' | 'random' | 'cyclic' | 'unknown' {
        // Calculate differences between consecutive values
        const diffs = values.slice(1).map((v, i) => v[0] - values[i][0]);
        
        // Check for sequential pattern
        const isSequential = diffs.every(d => Math.abs(d - diffs[0]) < 0.1);
        if (isSequential) return 'sequential';
        
        // Check for cyclic pattern
        const period = this.calculatePeriod(values);
        if (period > 0) return 'cyclic';
        
        // Check for random pattern
        const entropy = this.calculateEntropy(values);
        if (entropy > 0.8) return 'random';
        
        return 'unknown';
    }

    private determinePatternTypeFromLine(line: any): 'sequential' | 'random' | 'cyclic' | 'unknown' {
        if (line.period > 0) return 'cyclic';
        if (line.correlation > 0.8) return 'sequential';
        if (line.entropy > 0.8) return 'random';
        return 'unknown';
    }

    private calculatePeriod(values: number[][]): number {
        // Implement period detection using autocorrelation
        const autocorr = this.autocorrelation(values.map(v => v[0]));
        const peaks = this.findPeaks(autocorr);
        return peaks.length > 0 ? peaks[0] : 0;
    }

    private calculateEntropy(values: number[][]): number {
        // Calculate Shannon entropy
        const bins = new Map<number, number>();
        values.forEach(v => {
            const bin = Math.floor(v[0] * 10) / 10;
            bins.set(bin, (bins.get(bin) || 0) + 1);
        });

        const total = values.length;
        let entropy = 0;
        bins.forEach(count => {
            const p = count / total;
            entropy -= p * Math.log2(p);
        });

        return entropy;
    }

    private calculateCorrelation(values: number[][]): number {
        // Calculate Pearson correlation between consecutive values
        const x = values.map(v => v[0]);
        const y = values.slice(1).map(v => v[0]);
        
        const meanX = x.reduce((a, b) => a + b) / x.length;
        const meanY = y.reduce((a, b) => a + b) / y.length;
        
        const numerator = x.reduce((sum, xi, i) => 
            sum + (xi - meanX) * (y[i] - meanY), 0);
        
        const denominator = Math.sqrt(
            x.reduce((sum, xi) => sum + Math.pow(xi - meanX, 2), 0) *
            y.reduce((sum, yi) => sum + Math.pow(yi - meanY, 2), 0)
        );
        
        return denominator === 0 ? 0 : numerator / denominator;
    }

    private autocorrelation(values: number[]): number[] {
        const n = values.length;
        const result: number[] = [];
        
        for (let lag = 0; lag < n; lag++) {
            let sum = 0;
            for (let i = 0; i < n - lag; i++) {
                sum += values[i] * values[i + lag];
            }
            result.push(sum / (n - lag));
        }
        
        return result;
    }

    private findPeaks(values: number[]): number[] {
        const peaks: number[] = [];
        for (let i = 1; i < values.length - 1; i++) {
            if (values[i] > values[i - 1] && values[i] > values[i + 1]) {
                peaks.push(i);
            }
        }
        return peaks;
    }

    private findRegionsInLine(memoryInfo: MemoryRegion[], line: any): MemoryRegion[] {
        return memoryInfo.filter(region => {
            const x = region.normalizedAddress || 0;
            const y = region.normalizedSize || 0;
            return Math.abs(y - (line.slope * x + line.intercept)) < 0.1;
        });
    }

    private calculateEntropyForLine(line: any): number {
        // Calculate entropy based on line parameters
        return Math.abs(line.slope) > 0.1 ? 0.5 : 0.8;
    }

    public getPatterns(): MemoryPattern[] {
        return this.patterns;
    }

    public getAnomalies(): Anomaly[] {
        return this.anomalies;
    }

    public detectAnomalies(patterns: MemoryPattern[]): Anomaly[] {
        const anomalies: Anomaly[] = [];
        
        // Detect unusual access patterns
        patterns.forEach(pattern => {
            if (pattern.confidence < 0.3) {
                anomalies.push({
                    type: 'unusual_access',
                    severity: 'high',
                    description: 'Unusual memory access pattern detected',
                    affectedRegions: pattern.regions,
                    timestamp: Date.now(),
                    confidence: 1 - pattern.confidence
                });
            }
        });

        // Detect potential memory leaks
        const recentPatterns = patterns.filter(p => 
            p.regions.some(r => r.metadata?.accessCount && r.metadata.accessCount > 1000)
        );
        
        if (recentPatterns.length > 0) {
            anomalies.push({
                type: 'memory_leak',
                severity: 'critical',
                description: 'Potential memory leak detected',
                affectedRegions: recentPatterns.flatMap(p => p.regions),
                timestamp: Date.now(),
                confidence: 0.8
            });
        }

        return anomalies;
    }
} 