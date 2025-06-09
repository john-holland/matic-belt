import { EventEmitter } from 'events';
import * as tf from '@tensorflow/tfjs';

export interface TimeContext {
    timestamp: number;
    scene: string;
    mediaLength: number;
    coolingRate: number;
}

interface Timestamp {
    time: number;
    confidence: number;
    position: { x: number; y: number };
}

export class TimeAnalyzer extends EventEmitter {
    private canvas: HTMLCanvasElement;
    private context: CanvasRenderingContext2D;
    private mediaLength: number = 0;
    private currentTime: number = 0;
    private sessionStartTime: number = 0;
    private detectedTimestamps: Timestamp[] = [];
    private baseCoolingRate: number = 0.995;
    private timestampRegex: RegExp = /(\d{1,2}):(\d{2})(?::(\d{2}))?/g;
    private isAnalyzing: boolean = false;
    private defaultSessionLength: number = 24 * 60 * 60; // 24 hours in seconds

    constructor() {
        super();
        this.canvas = document.createElement('canvas');
        this.context = this.canvas.getContext('2d')!;
        this.sessionStartTime = Date.now();
    }

    public setMediaLength(length: number) {
        this.mediaLength = length;
        this.updateCoolingRate();
    }

    public updateCurrentTime(time: number) {
        this.currentTime = time;
        this.updateCoolingRate();
    }

    public async analyzeFrame(videoElement: HTMLVideoElement) {
        if (!this.isAnalyzing) return;

        // Set canvas dimensions to match video
        this.canvas.width = videoElement.videoWidth;
        this.canvas.height = videoElement.videoHeight;

        // Draw current frame
        this.context.drawImage(videoElement, 0, 0);

        // Get image data for analysis
        const imageData = this.context.getImageData(0, 0, this.canvas.width, this.canvas.height);
        
        // Detect timestamps in the frame
        await this.detectTimestamps(imageData);
    }

    private async detectTimestamps(imageData: ImageData) {
        // Convert image to tensor for processing
        const tensor = tf.browser.fromPixels(imageData)
            .resizeBilinear([224, 224])
            .expandDims()
            .div(255.0);

        // Use OCR or text detection model to find timestamps
        // This is a placeholder for actual text detection logic
        const detectedText = await this.detectText(tensor);
        
        // Parse timestamps from detected text
        this.parseTimestamps(detectedText);

        // Clean up tensor
        tensor.dispose();
    }

    private async detectText(tensor: tf.Tensor): Promise<string[]> {
        // This would typically use a pre-trained OCR model
        // For now, return empty array as placeholder
        return [];
    }

    private parseTimestamps(detectedText: string[]) {
        const newTimestamps: Timestamp[] = [];

        for (const text of detectedText) {
            let match;
            while ((match = this.timestampRegex.exec(text)) !== null) {
                const hours = parseInt(match[1]);
                const minutes = parseInt(match[2]);
                const seconds = match[3] ? parseInt(match[3]) : 0;

                const totalSeconds = hours * 3600 + minutes * 60 + seconds;
                
                // Calculate confidence based on format and position
                const confidence = this.calculateTimestampConfidence(match[0], match.index);
                
                newTimestamps.push({
                    time: totalSeconds,
                    confidence,
                    position: this.estimateTimestampPosition(match.index, text)
                });
            }
        }

        // Update detected timestamps
        this.detectedTimestamps = this.mergeTimestamps(this.detectedTimestamps, newTimestamps);
        
        // Update cooling rate based on new timestamps
        this.updateCoolingRate();
    }

    private calculateTimestampConfidence(timestamp: string, position: number): number {
        // Calculate confidence based on:
        // 1. Format completeness (HH:MM:SS > HH:MM)
        // 2. Position in frame (prefer timestamps in typical locations)
        // 3. Context (surrounding text, if any)
        const formatScore = timestamp.includes(':') ? 1.0 : 0.8;
        const positionScore = this.calculatePositionScore(position);
        return (formatScore + positionScore) / 2;
    }

    private calculatePositionScore(position: number): number {
        // Prefer timestamps in typical locations (e.g., bottom corners)
        // This is a simplified version - could be more sophisticated
        return 0.8;
    }

    private estimateTimestampPosition(index: number, text: string): { x: number; y: number } {
        // Estimate position based on text index and canvas dimensions
        // This is a placeholder - would need actual text detection coordinates
        return {
            x: (index / text.length) * this.canvas.width,
            y: this.canvas.height * 0.9 // Assume bottom of frame
        };
    }

    private mergeTimestamps(existing: Timestamp[], newTimestamps: Timestamp[]): Timestamp[] {
        // Merge new timestamps with existing ones, removing duplicates
        // and keeping the highest confidence version
        const merged = new Map<number, Timestamp>();

        // Add existing timestamps
        for (const ts of existing) {
            merged.set(ts.time, ts);
        }

        // Add or update with new timestamps
        for (const ts of newTimestamps) {
            const existing = merged.get(ts.time);
            if (!existing || ts.confidence > existing.confidence) {
                merged.set(ts.time, ts);
            }
        }

        return Array.from(merged.values());
    }

    private updateCoolingRate() {
        if (this.mediaLength === 0) return;

        // Calculate base cooling rate based on media length and session duration
        const lengthBasedRate = this.calculateLengthBasedRate();

        // Adjust based on detected timestamps
        const timestampAdjustment = this.calculateTimestampAdjustment();

        // Calculate session-based adjustment
        const sessionAdjustment = this.calculateSessionAdjustment();

        // Calculate final cooling rate
        const coolingRate = lengthBasedRate * timestampAdjustment * sessionAdjustment;

        // Emit update
        this.emit('coolingRateUpdate', {
            coolingRate,
            mediaLength: this.mediaLength,
            currentTime: this.currentTime,
            detectedTimestamps: this.detectedTimestamps,
            sessionDuration: this.getSessionDuration()
        });
    }

    private calculateLengthBasedRate(): number {
        // Adjust cooling rate based on media length
        // Longer media = slower cooling
        // Use log scale to handle both short and very long content
        const lengthFactor = Math.log10(Math.max(this.mediaLength, 3600)) / Math.log10(this.defaultSessionLength);
        return this.baseCoolingRate * (1 + lengthFactor * 0.2);
    }

    private calculateTimestampAdjustment(): number {
        if (this.detectedTimestamps.length === 0) return 1.0;

        // Calculate average confidence of detected timestamps
        const avgConfidence = this.detectedTimestamps.reduce(
            (sum, ts) => sum + ts.confidence,
            0
        ) / this.detectedTimestamps.length;

        // Adjust cooling rate based on timestamp confidence
        return 1.0 + (avgConfidence - 0.5) * 0.2;
    }

    private calculateSessionAdjustment(): number {
        const sessionDuration = this.getSessionDuration();
        
        // Adjust cooling rate based on session duration
        // Longer sessions = slower cooling
        const sessionFactor = Math.log10(sessionDuration) / Math.log10(this.defaultSessionLength);
        return 1.0 + sessionFactor * 0.1;
    }

    private getSessionDuration(): number {
        return (Date.now() - this.sessionStartTime) / 1000; // Convert to seconds
    }

    public startAnalysis() {
        this.isAnalyzing = true;
        this.sessionStartTime = Date.now();
    }

    public stopAnalysis() {
        this.isAnalyzing = false;
    }

    public getCurrentCoolingRate(): number {
        return this.calculateLengthBasedRate() * 
               this.calculateTimestampAdjustment() * 
               this.calculateSessionAdjustment();
    }

    public getDetectedTimestamps(): Timestamp[] {
        return [...this.detectedTimestamps];
    }

    public getTimeContext(): TimeContext {
        return {
            timestamp: Date.now(),
            scene: '',
            mediaLength: this.mediaLength,
            coolingRate: this.getCurrentCoolingRate()
        };
    }
} 