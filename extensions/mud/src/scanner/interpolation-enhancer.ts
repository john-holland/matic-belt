import { Vector3 } from 'three';
import { LightInterpolator, RayTraceResult } from './light-interpolator';
import { ObjectDetector, DetectedObject } from './object-detector';
import { EventEmitter } from 'events';
import { config } from '../config';

interface InterpolationDescription {
  lightPattern: string;
  objectContext: string;
  confidence: number;
}

interface EnhancedInterpolation {
  originalIntensity: number;
  description: string;
  enhancedImage?: string; // Base64 encoded image
  confidence: number;
}

export class InterpolationEnhancer extends EventEmitter {
  private lightInterpolator: LightInterpolator;
  private objectDetector: ObjectDetector;
  private confidenceThreshold: number;
  private lastEnhancedResult?: EnhancedInterpolation;

  constructor(
    lightInterpolator: LightInterpolator,
    objectDetector: ObjectDetector,
    confidenceThreshold: number = 0.7
  ) {
    super();
    this.lightInterpolator = lightInterpolator;
    this.objectDetector = objectDetector;
    this.confidenceThreshold = confidenceThreshold;
  }

  public async enhanceInterpolation(
    position: Vector3,
    direction: Vector3
  ): Promise<EnhancedInterpolation> {
    // Get light interpolation results
    const lightIntensity = this.lightInterpolator.getInterpolatedLight(position, direction);
    const rayTraceResults = this.lightInterpolator['traceRays'](position, direction);

    // Get object detection results
    const detectedObjects = await this.objectDetector.detectObjects(new ImageData(640, 480));

    // Generate description
    const description = await this.generateDescription(rayTraceResults, detectedObjects);

    // If confidence is high enough, generate enhanced image
    let enhancedImage: string | undefined;
    if (description.confidence >= this.confidenceThreshold) {
      enhancedImage = await this.generateEnhancedImage(description);
    }

    const result: EnhancedInterpolation = {
      originalIntensity: lightIntensity,
      description: this.formatDescription(description),
      enhancedImage,
      confidence: description.confidence
    };

    this.lastEnhancedResult = result;
    this.emit('enhancementComplete', result);
    return result;
  }

  private async generateDescription(
    rayTraceResults: RayTraceResult[],
    detectedObjects: DetectedObject[]
  ): Promise<InterpolationDescription> {
    // Analyze light patterns
    const lightPattern = this.analyzeLightPattern(rayTraceResults);
    
    // Analyze object context
    const objectContext = this.analyzeObjectContext(detectedObjects);
    
    // Calculate overall confidence
    const confidence = this.calculateConfidence(rayTraceResults, detectedObjects);

    return {
      lightPattern,
      objectContext,
      confidence
    };
  }

  private analyzeLightPattern(results: RayTraceResult[]): string {
    if (results.length === 0) return 'No significant light patterns detected';

    const patterns: string[] = [];
    let totalSpecularity = 0;

    for (const result of results) {
      const { quad, normal } = result;
      totalSpecularity += quad.specularity;

      if (quad.specularity > 0.8) {
        patterns.push('strong specular reflection');
      } else if (quad.specularity > 0.5) {
        patterns.push('moderate reflection');
      }

      // Analyze normal direction
      if (normal.y > 0.8) {
        patterns.push('overhead lighting');
      } else if (normal.y < -0.8) {
        patterns.push('ground reflection');
      }
    }

    const avgSpecularity = totalSpecularity / results.length;
    if (avgSpecularity > 0.7) {
      patterns.push('highly reflective surface');
    }

    return patterns.length > 0 
      ? patterns.join(', ')
      : 'diffuse lighting pattern';
  }

  private analyzeObjectContext(objects: DetectedObject[]): string {
    if (objects.length === 0) return 'No objects detected';

    const contexts: string[] = [];
    let hasRoadSigns = false;
    let hasVehicles = false;

    for (const obj of objects) {
      if (obj.type === 'stop' || obj.type === 'yield' || obj.type === 'speed_limit') {
        hasRoadSigns = true;
        contexts.push(`${obj.type} sign`);
      } else if (obj.type === 'car' || obj.type === 'truck') {
        hasVehicles = true;
        contexts.push(`${obj.type} ${obj.relativeSpeed ? `moving at ${Math.abs(obj.relativeSpeed).toFixed(1)} km/h relative speed` : ''}`);
      } else if (obj.sizeComparison) {
        contexts.push(`object similar in size to ${obj.sizeComparison.referenceType}`);
      }
    }

    if (hasRoadSigns && hasVehicles) {
      contexts.push('traffic scene');
    }

    return contexts.join(', ');
  }

  private calculateConfidence(
    rayTraceResults: RayTraceResult[],
    detectedObjects: DetectedObject[]
  ): number {
    // Calculate confidence based on multiple factors
    const rayConfidence = Math.min(1, rayTraceResults.length / 5); // More rays = higher confidence
    const objectConfidence = Math.min(1, detectedObjects.length / 3); // More objects = higher confidence
    
    // Weight the factors
    return (rayConfidence * 0.6) + (objectConfidence * 0.4);
  }

  private async generateEnhancedImage(description: InterpolationDescription): Promise<string> {
    // In a real implementation, this would call Stable Diffusion API
    // For now, we'll return a placeholder
    const prompt = `A realistic scene showing ${description.lightPattern} with ${description.objectContext}`;
    
    try {
      // TODO: Implement actual Stable Diffusion API call
      // const response = await fetch(config.STABLE_DIFFUSION_API_URL, {
      //   method: 'POST',
      //   headers: {
      //     'Content-Type': 'application/json',
      //     'Authorization': `Bearer ${config.STABLE_DIFFUSION_API_KEY}`
      //   },
      //   body: JSON.stringify({
      //     prompt,
      //     num_inference_steps: 50,
      //     guidance_scale: 7.5
      //   })
      // });
      // const result = await response.json();
      // return result.images[0];

      return 'placeholder_base64_image';
    } catch (error) {
      console.error('Failed to generate enhanced image:', error);
      return '';
    }
  }

  private formatDescription(description: InterpolationDescription): string {
    return `Scene Analysis:
Light Pattern: ${description.lightPattern}
Object Context: ${description.objectContext}
Confidence: ${(description.confidence * 100).toFixed(1)}%`;
  }

  public getLastEnhancedResult(): EnhancedInterpolation | undefined {
    return this.lastEnhancedResult;
  }
} 