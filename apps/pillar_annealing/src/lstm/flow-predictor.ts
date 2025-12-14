/**
 * LSTM model for predicting and learning flow patterns around pillars
 */

import * as tf from '@tensorflow/tfjs';
import { FlowField, LSTMPrediction, WindData } from '../types';

export class FlowPredictor {
  private model: tf.LayersModel | null = null;
  private sequenceLength: number = 10;
  private featureSize: number = 8; // input features per timestep
  private hiddenSize: number = 64;
  private isTrained: boolean = false;
  
  constructor() {
    this.buildModel();
  }
  
  /**
   * Build LSTM model architecture
   */
  private buildModel(): void {
    const model = tf.sequential();
    
    // Input layer
    model.add(tf.layers.inputLayer({
      inputShape: [this.sequenceLength, this.featureSize],
      name: 'input'
    }));
    
    // LSTM layers
    model.add(tf.layers.lstm({
      units: this.hiddenSize,
      returnSequences: true,
      activation: 'tanh',
      name: 'lstm1'
    }));
    
    model.add(tf.layers.dropout({
      rate: 0.2,
      name: 'dropout1'
    }));
    
    model.add(tf.layers.lstm({
      units: this.hiddenSize / 2,
      returnSequences: false,
      activation: 'tanh',
      name: 'lstm2'
    }));
    
    model.add(tf.layers.dropout({
      rate: 0.2,
      name: 'dropout2'
    }));
    
    // Dense layers for output
    model.add(tf.layers.dense({
      units: 64,
      activation: 'relu',
      name: 'dense1'
    }));
    
    model.add(tf.layers.dense({
      units: 32,
      activation: 'relu',
      name: 'dense2'
    }));
    
    // Output layer: flow vectors (3D) + quality metrics
    // Output: [flow_x, flow_y, flow_z, quality, turbulence, pressure_gradient]
    model.add(tf.layers.dense({
      units: 6,
      activation: 'linear',
      name: 'output'
    }));
    
    // Compile model
    model.compile({
      optimizer: tf.train.adam(0.001),
      loss: 'meanSquaredError',
      metrics: ['meanAbsoluteError']
    });
    
    this.model = model;
  }
  
  /**
   * Extract features from flow field and wind data
   */
  private extractFeatures(flowField: FlowField, windData: WindData): number[] {
    // Aggregate flow field statistics
    const velocities = flowField.vectors.map(v => Math.sqrt(v.x ** 2 + v.y ** 2 + v.z ** 2));
    const avgVelocity = velocities.reduce((a, b) => a + b, 0) / velocities.length;
    const maxVelocity = Math.max(...velocities);
    const minVelocity = Math.min(...velocities);
    const velocityVariance = this.calculateVariance(velocities);
    
    // Pressure statistics
    const avgPressure = flowField.pressure.reduce((a, b) => a + b, 0) / flowField.pressure.length;
    const pressureVariance = this.calculateVariance(flowField.pressure);
    
    // Wind characteristics
    const windSpeed = windData.averageSpeed;
    const windDirection = windData.averageDirection / 360; // normalize to 0-1
    
    return [
      avgVelocity / 20, // normalize (assuming max 20 m/s)
      maxVelocity / 20,
      minVelocity / 20,
      velocityVariance,
      avgPressure / 2, // normalize
      pressureVariance,
      windSpeed / 20,
      windDirection
    ];
  }
  
  /**
   * Calculate variance
   */
  private calculateVariance(values: number[]): number {
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    return values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length;
  }
  
  /**
   * Train model on sequence of flow fields
   */
  async train(
    sequences: Array<{ flowField: FlowField; windData: WindData }>,
    epochs: number = 50,
    batchSize: number = 32
  ): Promise<void> {
    if (!this.model) {
      throw new Error('Model not initialized');
    }
    
    // Prepare training data
    const X: number[][][] = [];
    const y: number[][] = [];
    
    for (let i = this.sequenceLength; i < sequences.length; i++) {
      const sequence: number[][] = [];
      for (let j = i - this.sequenceLength; j < i; j++) {
        sequence.push(this.extractFeatures(sequences[j].flowField, sequences[j].windData));
      }
      X.push(sequence);
      
      // Target: next flow field features + quality metrics
      const currentFlow = sequences[i].flowField;
      const currentWind = sequences[i].windData;
      
      // Calculate target output
      const avgFlow = currentFlow.vectors.reduce(
        (sum, v) => ({
          x: sum.x + v.x,
          y: sum.y + v.y,
          z: sum.z + v.z
        }),
        { x: 0, y: 0, z: 0 }
      );
      const count = currentFlow.vectors.length;
      const avgFlowVec = {
        x: avgFlow.x / count,
        y: avgFlow.y / count,
        z: avgFlow.z / count
      };
      
      // Normalize flow vector
      const flowMag = Math.sqrt(avgFlowVec.x ** 2 + avgFlowVec.y ** 2 + avgFlowVec.z ** 2);
      const normalizedFlow = {
        x: avgFlowVec.x / (flowMag || 1) / 20,
        y: avgFlowVec.y / (flowMag || 1) / 20,
        z: avgFlowVec.z / (flowMag || 1) / 20
      };
      
      // Flow quality (simplified)
      const quality = this.calculateFlowQuality(currentFlow);
      const turbulence = currentWind.turbulence;
      const pressureGrad = this.calculatePressureGradient(currentFlow);
      
      y.push([
        normalizedFlow.x,
        normalizedFlow.y,
        normalizedFlow.z,
        quality,
        turbulence,
        pressureGrad
      ]);
    }
    
    if (X.length === 0) {
      console.warn('No training data available');
      return;
    }
    
    // Convert to tensors
    const xs = tf.tensor3d(X);
    const ys = tf.tensor2d(y);
    
    // Train
    await this.model.fit(xs, ys, {
      epochs,
      batchSize,
      shuffle: true,
      validationSplit: 0.2,
      callbacks: {
        onEpochEnd: (epoch, logs) => {
          console.log(`Epoch ${epoch + 1}/${epochs}, loss: ${logs?.loss?.toFixed(4)}`);
        }
      }
    });
    
    xs.dispose();
    ys.dispose();
    
    this.isTrained = true;
  }
  
  /**
   * Predict next flow state
   */
  async predict(history: Array<{ flowField: FlowField; windData: WindData }>): Promise<LSTMPrediction> {
    if (!this.model || !this.isTrained) {
      // Return default prediction if model not trained
      return this.getDefaultPrediction(history[history.length - 1]);
    }
    
    // Prepare input sequence
    const sequence: number[][] = [];
    const startIdx = Math.max(0, history.length - this.sequenceLength);
    
    for (let i = startIdx; i < history.length; i++) {
      sequence.push(this.extractFeatures(history[i].flowField, history[i].windData));
    }
    
    // Pad if necessary
    while (sequence.length < this.sequenceLength) {
      sequence.unshift(sequence[0] || new Array(this.featureSize).fill(0));
    }
    
    // Predict
    const input = tf.tensor3d([sequence]);
    const prediction = this.model.predict(input) as tf.Tensor;
    const values = await prediction.data();
    
    input.dispose();
    prediction.dispose();
    
    // Parse output
    const flowScale = 20; // denormalize
    const nextFlowVectors = [
      { x: values[0] * flowScale, y: values[1] * flowScale, z: values[2] * flowScale }
    ];
    
    return {
      nextFlowVectors,
      flowQuality: Math.max(0, Math.min(1, values[3])),
      turbulence: Math.max(0, Math.min(1, values[4])),
      pressureGradient: [values[5]]
    };
  }
  
  /**
   * Get default prediction when model isn't trained
   */
  private getDefaultPrediction(
    current: { flowField: FlowField; windData: WindData }
  ): LSTMPrediction {
    const avgFlow = current.flowField.vectors[0] || { x: 0, y: 0, z: 0 };
    return {
      nextFlowVectors: [avgFlow],
      flowQuality: 0.5,
      turbulence: current.windData.turbulence,
      pressureGradient: [0]
    };
  }
  
  /**
   * Calculate flow quality metric
   */
  private calculateFlowQuality(flowField: FlowField): number {
    const velocities = flowField.vectors.map(v => Math.sqrt(v.x ** 2 + v.y ** 2 + v.z ** 2));
    const variance = this.calculateVariance(velocities);
    return 1 / (1 + variance);
  }
  
  /**
   * Calculate pressure gradient
   */
  private calculatePressureGradient(flowField: FlowField): number {
    if (flowField.pressure.length < 2) return 0;
    const gradients: number[] = [];
    // Simplified gradient calculation
    for (let i = 1; i < flowField.pressure.length; i++) {
      gradients.push(Math.abs(flowField.pressure[i] - flowField.pressure[i - 1]));
    }
    return gradients.reduce((a, b) => a + b, 0) / gradients.length;
  }
  
  /**
   * Save model
   */
  async saveModel(path: string): Promise<void> {
    if (!this.model) return;
    await this.model.save(`file://${path}`);
  }
  
  /**
   * Load model
   */
  async loadModel(path: string): Promise<void> {
    this.model = await tf.loadLayersModel(`file://${path}/model.json`);
    this.isTrained = true;
  }
}

