import { Vector3 } from 'three';
import { EventEmitter } from 'events';

// Add ImageData type declaration
declare global {
  interface ImageData {
    width: number;
    height: number;
    data: Uint8ClampedArray;
  }
}

export interface RoadSign {
    type: string;
    standardSize: Vector3;
}

export interface DetectedObject {
    type: string;
    size: Vector3;
    position: Vector3;
    confidence: number;
    speed?: number;
    relativeSpeed?: number;
    sizeComparison?: {
        referenceType: string;
        ratio: number;
    };
}

export class ObjectDetector extends EventEmitter {
    private knownSigns: Map<string, RoadSign>;
    private knownObjects: Set<string>;
    private currentPosition: Vector3;
    private currentSpeed: number;

    constructor() {
        super();
        this.knownSigns = new Map();
        this.knownObjects = new Set();
        this.currentPosition = new Vector3();
        this.currentSpeed = 0;

        // Initialize with some common road signs
        this.initializeKnownSigns();
    }

    private initializeKnownSigns(): void {
        this.knownSigns.set('stop', {
            type: 'stop',
            standardSize: new Vector3(0.75, 0.75, 0.02)
        });
        this.knownSigns.set('yield', {
            type: 'yield',
            standardSize: new Vector3(0.9, 0.9, 0.02)
        });
        this.knownSigns.set('speed_limit', {
            type: 'speed_limit',
            standardSize: new Vector3(0.6, 0.6, 0.02)
        });
    }

    public async initialize(): Promise<void> {
        // Initialize any required resources
        this.knownObjects = new Set(['car', 'truck', 'bicycle', 'pedestrian']);
    }

    public async cleanup(): Promise<void> {
        // Clean up any resources
        this.knownObjects.clear();
    }

    public async updatePosition(position: Vector3, speed: number): Promise<void> {
        this.currentPosition = position;
        this.currentSpeed = speed;
    }

    public async detectObjects(imageData: ImageData): Promise<DetectedObject[]> {
        const detectedObjects: DetectedObject[] = [];
        
        // In a real implementation, this would use computer vision to detect objects
        // For now, we'll simulate some detections
        const simulatedObjects = this.simulateDetections();
        
        for (const obj of simulatedObjects) {
            const analyzedObject = await this.analyzeObject(obj);
            detectedObjects.push(analyzedObject);
        }

        this.emit('objectsDetected', detectedObjects);
        return detectedObjects;
    }

    private async analyzeObject(obj: DetectedObject): Promise<DetectedObject> {
        if (this.knownSigns.has(obj.type)) {
            return this.analyzeRoadSign(obj);
        } else if (this.knownObjects.has(obj.type)) {
            return this.analyzeKnownObject(obj);
        } else {
            return this.analyzeUnknownObject(obj);
        }
    }

    private async analyzeRoadSign(obj: DetectedObject): Promise<DetectedObject> {
        const standardSize = this.knownSigns.get(obj.type)?.standardSize;
        if (!standardSize) return obj;

        const sizeRatio = obj.size.length() / standardSize.length();
        return {
            ...obj,
            sizeComparison: {
                referenceType: obj.type,
                ratio: sizeRatio
            }
        };
    }

    private async analyzeKnownObject(obj: DetectedObject): Promise<DetectedObject> {
        // For known objects, we can estimate their speed relative to us
        const relativeSpeed = this.calculateRelativeSpeed(obj);
        return {
            ...obj,
            relativeSpeed
        };
    }

    private async analyzeUnknownObject(obj: DetectedObject): Promise<DetectedObject> {
        // For unknown objects, we can compare their size to known objects
        const closestKnown = this.findClosestKnownObject(obj);
        if (closestKnown) {
            return {
                ...obj,
                sizeComparison: {
                    referenceType: closestKnown,
                    ratio: this.calculateSizeRatio(obj, closestKnown)
                }
            };
        }
        return obj;
    }

    private calculateRelativeSpeed(obj: DetectedObject): number {
        if (obj.speed === undefined) return 0;
        return obj.speed - this.currentSpeed;
    }

    private findClosestKnownObject(obj: DetectedObject): string | null {
        let closestType: string | null = null;
        let minDistance = Infinity;

        for (const knownType of this.knownObjects) {
            const distance = this.calculateObjectDistance(obj, knownType);
            if (distance < minDistance) {
                minDistance = distance;
                closestType = knownType;
            }
        }

        return closestType;
    }

    private calculateObjectDistance(obj: DetectedObject, knownType: string): number {
        // In a real implementation, this would use more sophisticated metrics
        // For now, we'll just use a simple size-based comparison
        return Math.abs(obj.size.length() - this.getExpectedSize(knownType));
    }

    private getExpectedSize(type: string): number {
        // In a real implementation, this would use a database of known object sizes
        // For now, we'll use some hardcoded values
        const sizes: { [key: string]: number } = {
            car: 4.5,
            truck: 8.0,
            bicycle: 1.7,
            pedestrian: 1.8
        };
        return sizes[type] || 1.0;
    }

    private calculateSizeRatio(obj: DetectedObject, referenceType: string): number {
        const expectedSize = this.getExpectedSize(referenceType);
        return obj.size.length() / expectedSize;
    }

    private simulateDetections(): DetectedObject[] {
        // Simulate some detections for testing
        return [
            {
                type: 'stop',
                size: new Vector3(0.8, 0.8, 0.02),
                position: new Vector3(10, 2, 0),
                confidence: 0.95
            },
            {
                type: 'car',
                size: new Vector3(4.2, 1.8, 1.5),
                position: new Vector3(20, 0, 0),
                confidence: 0.9,
                speed: 50
            },
            {
                type: 'unknown',
                size: new Vector3(2.5, 2.5, 2.5),
                position: new Vector3(15, 1, 5),
                confidence: 0.7
            }
        ];
    }
} 