import { LightInterpolator } from './light-interpolator';
import { ObjectDetector, DetectedObject } from './object-detector';
import { Vector3 } from 'three';
import { EventEmitter } from 'events';

export interface ScannerConfig {
  lightInterpolationEnabled: boolean;
  objectDetectionEnabled: boolean;
  gpsUpdateInterval: number;
}

export interface ScannerState {
  lightIntensity: number;
  detectedObjects: DetectedObject[];
  lastGpsUpdate: number;
  currentPosition: Vector3;
  currentSpeed: number;
}

export class ScannerManager extends EventEmitter {
  private lightInterpolator: LightInterpolator;
  private objectDetector: ObjectDetector;
  private config: ScannerConfig;
  private state: ScannerState;
  private gpsUpdateTimer: NodeJS.Timeout | null = null;

  constructor(config: Partial<ScannerConfig> = {}) {
    super();
    this.config = {
      lightInterpolationEnabled: true,
      objectDetectionEnabled: true,
      gpsUpdateInterval: 1000,
      ...config
    };

    this.lightInterpolator = new LightInterpolator();
    this.objectDetector = new ObjectDetector();

    this.state = {
      lightIntensity: 0,
      detectedObjects: [],
      lastGpsUpdate: Date.now(),
      currentPosition: new Vector3(),
      currentSpeed: 0
    };

    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    this.lightInterpolator.on('lightIntensityChanged', (intensity: number) => {
      this.state.lightIntensity = intensity;
      this.emit('stateChanged', this.state);
    });

    this.objectDetector.on('objectsDetected', (objects: DetectedObject[]) => {
      this.state.detectedObjects = objects;
      this.emit('stateChanged', this.state);
    });
  }

  public async start(): Promise<void> {
    if (this.config.lightInterpolationEnabled) {
      this.lightInterpolator.toggle(true);
    }

    if (this.config.objectDetectionEnabled) {
      await this.objectDetector.initialize();
      this.startGpsUpdates();
    }
  }

  public async stop(): Promise<void> {
    this.lightInterpolator.toggle(false);
    this.stopGpsUpdates();
    await this.objectDetector.cleanup();
  }

  public updateConfig(config: Partial<ScannerConfig>): void {
    this.config = { ...this.config, ...config };

    if (this.config.lightInterpolationEnabled) {
      this.lightInterpolator.toggle(true);
    } else {
      this.lightInterpolator.toggle(false);
    }

    if (this.config.objectDetectionEnabled) {
      this.startGpsUpdates();
    } else {
      this.stopGpsUpdates();
    }
  }

  public getState(): ScannerState {
    return { ...this.state };
  }

  public addQuad(position: Vector3, normal: Vector3, size: Vector3, specularity: number): void {
    this.lightInterpolator.addQuad(position, normal, size, specularity);
  }

  public removeQuad(position: Vector3): void {
    this.lightInterpolator.removeQuad(position);
  }

  public async updateGps(position: Vector3, speed: number): Promise<void> {
    this.state.currentPosition = position;
    this.state.currentSpeed = speed;
    this.state.lastGpsUpdate = Date.now();

    if (this.config.objectDetectionEnabled) {
      await this.objectDetector.updatePosition(position, speed);
    }
  }

  private startGpsUpdates(): void {
    if (this.gpsUpdateTimer) {
      clearInterval(this.gpsUpdateTimer);
    }

    this.gpsUpdateTimer = setInterval(async () => {
      // In a real implementation, this would get actual GPS data
      // For now, we'll just use the last known position and speed
      await this.updateGps(this.state.currentPosition, this.state.currentSpeed);
    }, this.config.gpsUpdateInterval);
  }

  private stopGpsUpdates(): void {
    if (this.gpsUpdateTimer) {
      clearInterval(this.gpsUpdateTimer);
      this.gpsUpdateTimer = null;
    }
  }
} 