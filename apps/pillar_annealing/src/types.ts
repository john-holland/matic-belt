/**
 * Type definitions for the pillar annealing framework
 */

export interface Location {
  lat: number;
  lng: number;
  elevation?: number;
}

export interface WindData {
  direction: number; // degrees (0-360)
  speed: number; // m/s
  averageSpeed: number; // m/s
  averageDirection: number; // degrees
  turbulence: number; // 0-1, intensity of wind variation
}

export interface PillarConfig {
  position: { x: number; y: number; z: number };
  height: number;
  radius: number;
  cogTeeth: number; // number of teeth in the cog
  toothDepth: number; // depth of cog teeth (0-1)
  rotation: number; // rotation around vertical axis
  material: 'stone' | 'concrete' | 'metal';
}

export interface FlowField {
  points: Array<{ x: number; y: number; z: number }>;
  vectors: Array<{ x: number; y: number; z: number }>; // velocity vectors
  pressure: number[]; // pressure at each point
}

export interface KiteDesign {
  shape: 'diamond' | 'delta' | 'box' | 'custom';
  material: 'paper' | 'cloth' | 'silk';
  dimensions: { width: number; height: number; depth?: number };
  attachmentPoints: Array<{ x: number; y: number; z: number }>;
  orientation: { x: number; y: number; z: number };
  color?: string;
}

export interface AnnealingState {
  iteration: number;
  temperature: number;
  energy: number;
  pillars: PillarConfig[];
  flowField: FlowField;
  bestEnergy: number;
  bestPillars: PillarConfig[];
}

export interface LSTMPrediction {
  nextFlowVectors: Array<{ x: number; y: number; z: number }>;
  flowQuality: number; // 0-1, how optimal the flow is
  turbulence: number;
  pressureGradient: number[];
}

export interface DesignConstraints {
  minPillarSpacing: number;
  maxPillarSpacing: number;
  minPillarHeight: number;
  maxPillarHeight: number;
  buildArea: { width: number; height: number };
  windShelter: boolean; // should area be sheltered from wind
  windDirection: number; // target wind direction for shelter
}

export interface GiantKiteConfig {
  position: { x: number; y: number; z: number };
  height: number; // meters, altitude of kite
  width: number; // meters, effective width
  surfaceArea: number; // m²
  type: 'kite' | 'mountain';
  material: 'cloth' | 'silk' | 'synthetic';
}

export interface MicroclimateResult {
  precipitationField: any;
  humidityEnhancement: {
    averageHumidity: number;
    enhancementFactor: number;
    maxHumidity: number;
  };
  fertilityAssessment: any;
  enhancementFactor: {
    fertilityIncrease: number;
    precipitationIncrease: number;
    humidityIncrease: number;
    overallImprovement: string;
  };
}

