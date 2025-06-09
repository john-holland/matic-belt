import { EventEmitter } from 'events';
import * as tf from '@tensorflow/tfjs';
import { SocialAnalyzer } from './social-analyzer';

export interface VisualAnalysis {
    timestamp: number;
    frameAverage: number;
    friendScore: number;
    foeScore: number;
    sceneCoherence: number;
    objects: ObjectDetection[];
    socialContext: SocialContext;
}

interface SocialContext {
    activeFriends: string[];
    chatActivity: number;
    captionActivity: number;
    socialCoherence: number;
}

interface ObjectDetection {
    label: string;
    confidence: number;
    isFriendly: boolean;
    plotRelevance: number;
    boundingBox: {
        x: number;
        y: number;
        width: number;
        height: number;
    };
}

interface FrameBuffer {
    frames: ImageData[];
    maxSize: number;
    currentAverage: ImageData | null;
}

export class VisualAnalyzer extends EventEmitter {
    private model: tf.LayersModel | null = null;
    private frameBuffer: FrameBuffer;
    private isAnalyzing: boolean = false;
    private socialAnalyzer: SocialAnalyzer;
    private canvas: HTMLCanvasElement;
    private context: CanvasRenderingContext2D;
    private friendlyObjects: Set<string> = new Set([
        'book', 'phone', 'computer', 'car', 'door', 'key', 'map',
        'letter', 'document', 'food', 'drink', 'medicine', 'tool'
    ]);
    private hostileObjects: Set<string> = new Set([
        'gun', 'knife', 'bomb', 'weapon', 'explosive', 'trap'
    ]);
    private plotProgressionObjects: Set<string> = new Set([
        'clue', 'evidence', 'map', 'key', 'document', 'letter',
        'diary', 'journal', 'photo', 'recording'
    ]);
    private maxBufferSize: number = 30; // 1 second at 30fps

    constructor() {
        super();
        this.canvas = document.createElement('canvas');
        this.context = this.canvas.getContext('2d')!;
        this.frameBuffer = {
            frames: [],
            maxSize: this.maxBufferSize,
            currentAverage: null
        };
        this.socialAnalyzer = new SocialAnalyzer();
        this.setupSocialAnalyzer();
    }

    private setupSocialAnalyzer() {
        this.socialAnalyzer.on('analysis', (analysis) => {
            this.emit('socialUpdate', analysis);
        });
    }

    public async analyzeFrame(
        videoElement: HTMLVideoElement,
        currentTime: number
    ): Promise<VisualAnalysis> {
        if (!this.isAnalyzing) return this.getEmptyAnalysis();

        // Get frame data
        const frameData = this.captureFrame(videoElement);
        if (!frameData) return this.getEmptyAnalysis();

        // Update frame buffer
        this.updateFrameBuffer(frameData);

        // Get social analysis
        const socialAnalysis = await this.socialAnalyzer.analyzeFrame(videoElement, currentTime);

        // Process frame with model
        const predictions = await this.processFrame(frameData);
        const objects = this.processPredictions(predictions);

        // Calculate metrics
        const frameAverage = this.calculateFrameAverage();
        const { friendScore, foeScore } = this.calculateFriendFoeScores(objects, socialAnalysis);
        const sceneCoherence = this.calculateSceneCoherence(objects);

        const analysis: VisualAnalysis = {
            timestamp: currentTime,
            frameAverage,
            friendScore,
            foeScore,
            sceneCoherence,
            objects,
            socialContext: {
                activeFriends: socialAnalysis.activeFriends,
                chatActivity: socialAnalysis.chatActivity,
                captionActivity: socialAnalysis.captionActivity,
                socialCoherence: socialAnalysis.socialCoherence
            }
        };

        this.emit('analysis', analysis);
        return analysis;
    }

    private captureFrame(videoElement: HTMLVideoElement): ImageData | null {
        // Set canvas dimensions to match video
        this.canvas.width = videoElement.videoWidth;
        this.canvas.height = videoElement.videoHeight;

        // Draw current frame
        this.context.drawImage(videoElement, 0, 0);

        // Get image data
        return this.context.getImageData(0, 0, this.canvas.width, this.canvas.height);
    }

    private async processFrame(frameData: ImageData): Promise<tf.Tensor> {
        // Convert frame to tensor
        const frameTensor = tf.browser.fromPixels(frameData)
            .resizeBilinear([224, 224])
            .expandDims()
            .div(255.0);

        // Process with model if available
        if (this.model) {
            const predictions = this.model.predict(frameTensor) as tf.Tensor;
            frameTensor.dispose();
            return predictions;
        }

        return frameTensor;
    }

    private processPredictions(predictions: tf.Tensor): ObjectDetection[] {
        // Convert predictions to object detections
        const detections: ObjectDetection[] = [];
        const data = predictions.dataSync();
        
        // Process predictions and create detections
        // This is a simplified version - you would need to implement proper object detection
        for (let i = 0; i < data.length; i += 5) {
            if (data[i] > 0.5) { // Confidence threshold
                detections.push({
                    label: `Object ${i/5}`,
                    confidence: data[i],
                    isFriendly: data[i+1] > 0.5,
                    plotRelevance: data[i+2],
                    boundingBox: {
                        x: data[i+3],
                        y: data[i+4],
                        width: 0.1,
                        height: 0.1
                    }
                });
            }
        }

        predictions.dispose();
        return detections;
    }

    private updateFrameBuffer(frameData: ImageData) {
        this.frameBuffer.frames.push(frameData);
        if (this.frameBuffer.frames.length > this.frameBuffer.maxSize) {
            this.frameBuffer.frames.shift();
        }
    }

    private calculateFrameAverage(): number {
        if (this.frameBuffer.frames.length === 0) return 0;
        return this.frameBuffer.frames.length / this.frameBuffer.maxSize;
    }

    private calculateFriendFoeScores(
        objects: ObjectDetection[],
        socialAnalysis: any
    ): { friendScore: number; foeScore: number } {
        let friendScore = 0;
        let foeScore = 0;

        // Calculate base scores from object detection
        for (const obj of objects) {
            if (obj.isFriendly) {
                friendScore += obj.confidence;
            } else {
                foeScore += obj.confidence;
            }
        }

        // Adjust scores based on social context
        const socialMultiplier = 1 + (socialAnalysis.socialCoherence * 0.5);
        friendScore *= socialMultiplier;
        foeScore *= (2 - socialMultiplier); // Inverse relationship

        // Normalize scores
        const total = friendScore + foeScore;
        if (total > 0) {
            friendScore /= total;
            foeScore /= total;
        }

        return { friendScore, foeScore };
    }

    private calculateSceneCoherence(objects: ObjectDetection[]): number {
        if (this.frameBuffer.frames.length < 2) return 1.0;

        // Calculate coherence based on object consistency
        let coherence = 0;
        const objectCount = objects.length;
        
        if (objectCount > 0) {
            // Check for consistent object presence
            const consistentObjects = objects.filter(obj => 
                obj.confidence > 0.7 && obj.plotRelevance > 0.5
            );
            coherence = consistentObjects.length / objectCount;
        }

        return coherence;
    }

    private getEmptyAnalysis(): VisualAnalysis {
        return {
            timestamp: Date.now(),
            frameAverage: 0,
            friendScore: 0,
            foeScore: 0,
            sceneCoherence: 1.0,
            objects: [],
            socialContext: {
                activeFriends: [],
                chatActivity: 0,
                captionActivity: 0,
                socialCoherence: 1.0
            }
        };
    }

    public addChatMessage(message: any) {
        this.socialAnalyzer.addChatMessage(message);
    }

    public setFriendThreshold(threshold: number) {
        this.socialAnalyzer.setFriendThreshold(threshold);
    }

    public startAnalysis() {
        this.isAnalyzing = true;
    }

    public stopAnalysis() {
        this.isAnalyzing = false;
    }

    public async loadModel(modelPath: string) {
        try {
            this.model = await tf.loadLayersModel(modelPath);
        } catch (error) {
            console.error('Failed to load model:', error);
        }
    }
} 