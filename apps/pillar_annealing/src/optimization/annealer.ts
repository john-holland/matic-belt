/**
 * Simulated annealing optimizer for pillar arrangement
 */

import { PillarConfig, DesignConstraints, AnnealingState, FlowField } from '../types';
import { WindFlowAnalyzer } from '../wind/wind-flow';
import { WindData } from '../types';

export class PillarAnnealer {
  private temperature: number;
  private coolingRate: number;
  private minTemperature: number;
  private currentState: AnnealingState;
  private flowAnalyzer: WindFlowAnalyzer;
  private constraints: DesignConstraints;
  private windData: WindData;
  
  constructor(
    initialPillars: PillarConfig[],
    constraints: DesignConstraints,
    windData: WindData,
    flowAnalyzer: WindFlowAnalyzer,
    initialTemp: number = 1000,
    coolingRate: number = 0.95,
    minTemp: number = 0.01
  ) {
    this.temperature = initialTemp;
    this.coolingRate = coolingRate;
    this.minTemperature = minTemp;
    this.constraints = constraints;
    this.windData = windData;
    this.flowAnalyzer = flowAnalyzer;
    
    // Calculate initial energy
    const initialFlowField = this.flowAnalyzer.calculateFlowField(initialPillars, windData);
    const initialEnergy = this.calculateEnergy(initialPillars, initialFlowField);
    
    this.currentState = {
      iteration: 0,
      temperature: initialTemp,
      energy: initialEnergy,
      pillars: [...initialPillars],
      flowField: initialFlowField,
      bestEnergy: initialEnergy,
      bestPillars: [...initialPillars]
    };
  }
  
  /**
   * Run one iteration of annealing
   */
  async step(): Promise<AnnealingState> {
    this.currentState.iteration++;
    
    // Generate neighbor state
    const neighborPillars = this.generateNeighbor(this.currentState.pillars);
    
    // Validate neighbor
    if (!this.isValidConfiguration(neighborPillars)) {
      return this.currentState;
    }
    
    // Calculate energy of neighbor
    const neighborFlowField = this.flowAnalyzer.calculateFlowField(neighborPillars, this.windData);
    const neighborEnergy = this.calculateEnergy(neighborPillars, neighborFlowField);
    
    // Accept or reject
    const deltaE = neighborEnergy - this.currentState.energy;
    const acceptanceProbability = Math.exp(-deltaE / this.temperature);
    
    if (deltaE < 0 || Math.random() < acceptanceProbability) {
      this.currentState.pillars = neighborPillars;
      this.currentState.flowField = neighborFlowField;
      this.currentState.energy = neighborEnergy;
      
      // Update best if better
      if (neighborEnergy < this.currentState.bestEnergy) {
        this.currentState.bestEnergy = neighborEnergy;
        this.currentState.bestPillars = [...neighborPillars];
      }
    }
    
    // Cool down
    this.temperature *= this.coolingRate;
    this.currentState.temperature = this.temperature;
    
    return this.currentState;
  }
  
  /**
   * Run annealing until convergence
   */
  async optimize(maxIterations: number = 1000): Promise<AnnealingState> {
    let iterationsWithoutImprovement = 0;
    const maxStagnantIterations = 50;
    
    while (this.temperature > this.minTemperature && this.currentState.iteration < maxIterations) {
      const previousBest = this.currentState.bestEnergy;
      await this.step();
      
      if (this.currentState.bestEnergy < previousBest) {
        iterationsWithoutImprovement = 0;
      } else {
        iterationsWithoutImprovement++;
      }
      
      // Early stopping if no improvement
      if (iterationsWithoutImprovement > maxStagnantIterations) {
        break;
      }
    }
    
    // Return best configuration
    this.currentState.pillars = [...this.currentState.bestPillars];
    this.currentState.flowField = this.flowAnalyzer.calculateFlowField(
      this.currentState.bestPillars,
      this.windData
    );
    this.currentState.energy = this.currentState.bestEnergy;
    
    return this.currentState;
  }
  
  /**
   * Calculate energy (cost) of a configuration
   * Lower is better
   */
  private calculateEnergy(pillars: PillarConfig[], flowField: FlowField): number {
    let energy = 0;
    
    // Flow quality (inverse - we want high quality, so low energy)
    const flowQuality = this.flowAnalyzer.calculateFlowQuality(flowField, {
      sheltered: this.constraints.windShelter,
      targetDirection: this.constraints.windDirection
    });
    energy += (1 - flowQuality) * 100; // Weight heavily
    
    // Pillar spacing constraints
    energy += this.calculateSpacingPenalty(pillars) * 50;
    
    // Material and size constraints
    energy += this.calculateSizePenalty(pillars) * 30;
    
    // Coverage (ensure area is covered)
    energy += this.calculateCoveragePenalty(pillars) * 20;
    
    return energy;
  }
  
  /**
   * Calculate penalty for pillar spacing violations
   */
  private calculateSpacingPenalty(pillars: PillarConfig[]): number {
    let penalty = 0;
    
    for (let i = 0; i < pillars.length; i++) {
      for (let j = i + 1; j < pillars.length; j++) {
        const p1 = pillars[i];
        const p2 = pillars[j];
        const distance = Math.sqrt(
          (p1.position.x - p2.position.x) ** 2 +
          (p1.position.z - p2.position.z) ** 2
        );
        
        if (distance < this.constraints.minPillarSpacing) {
          penalty += (this.constraints.minPillarSpacing - distance) ** 2;
        }
        if (distance > this.constraints.maxPillarSpacing) {
          penalty += (distance - this.constraints.maxPillarSpacing) ** 2;
        }
      }
    }
    
    return penalty;
  }
  
  /**
   * Calculate penalty for size violations
   */
  private calculateSizePenalty(pillars: PillarConfig[]): number {
    let penalty = 0;
    
    for (const pillar of pillars) {
      if (pillar.height < this.constraints.minPillarHeight) {
        penalty += (this.constraints.minPillarHeight - pillar.height) ** 2;
      }
      if (pillar.height > this.constraints.maxPillarHeight) {
        penalty += (pillar.height - this.constraints.maxPillarHeight) ** 2;
      }
    }
    
    return penalty;
  }
  
  /**
   * Calculate penalty for area coverage
   */
  private calculateCoveragePenalty(pillars: PillarConfig[]): number {
    // Simple check: ensure pillars are distributed across the area
    const { width, height } = this.constraints.buildArea;
    const gridSize = 5;
    const stepX = width / gridSize;
    const stepY = height / gridSize;
    
    let uncoveredCells = 0;
    
    for (let i = 0; i < gridSize; i++) {
      for (let j = 0; j < gridSize; j++) {
        const cellX = -width / 2 + i * stepX;
        const cellY = -height / 2 + j * stepY;
        
        let hasPillar = false;
        for (const pillar of pillars) {
          const dist = Math.sqrt(
            (pillar.position.x - cellX) ** 2 +
            (pillar.position.z - cellY) ** 2
          );
          if (dist < pillar.radius * 3) {
            hasPillar = true;
            break;
          }
        }
        
        if (!hasPillar) {
          uncoveredCells++;
        }
      }
    }
    
    return uncoveredCells / (gridSize * gridSize);
  }
  
  /**
   * Generate a neighbor configuration by modifying current state
   */
  private generateNeighbor(pillars: PillarConfig[]): PillarConfig[] {
    const neighbor = pillars.map(p => ({ ...p }));
    
    // Randomly modify one or more pillars
    const numModifications = Math.floor(Math.random() * 3) + 1;
    
    for (let i = 0; i < numModifications; i++) {
      const idx = Math.floor(Math.random() * neighbor.length);
      const pillar = neighbor[idx];
      
      // Random modification type
      const modType = Math.random();
      
      if (modType < 0.4) {
        // Move position
        const maxMove = this.constraints.minPillarSpacing * 0.3;
        pillar.position.x += (Math.random() - 0.5) * maxMove * 2;
        pillar.position.z += (Math.random() - 0.5) * maxMove * 2;
      } else if (modType < 0.7) {
        // Change height
        const heightRange = this.constraints.maxPillarHeight - this.constraints.minPillarHeight;
        pillar.height += (Math.random() - 0.5) * heightRange * 0.2;
        pillar.height = Math.max(
          this.constraints.minPillarHeight,
          Math.min(this.constraints.maxPillarHeight, pillar.height)
        );
      } else if (modType < 0.85) {
        // Change rotation
        pillar.rotation += (Math.random() - 0.5) * Math.PI * 0.5;
      } else {
        // Change radius or tooth parameters
        pillar.radius *= (0.9 + Math.random() * 0.2);
        pillar.radius = Math.max(0.5, Math.min(3, pillar.radius));
      }
    }
    
    return neighbor;
  }
  
  /**
   * Check if configuration is valid
   */
  private isValidConfiguration(pillars: PillarConfig[]): boolean {
    // Check bounds
    const { width, height } = this.constraints.buildArea;
    
    for (const pillar of pillars) {
      if (pillar.position.x < -width / 2 || pillar.position.x > width / 2) {
        return false;
      }
      if (pillar.position.z < -height / 2 || pillar.position.z > height / 2) {
        return false;
      }
    }
    
    // Check spacing
    for (let i = 0; i < pillars.length; i++) {
      for (let j = i + 1; j < pillars.length; j++) {
        const p1 = pillars[i];
        const p2 = pillars[j];
        const distance = Math.sqrt(
          (p1.position.x - p2.position.x) ** 2 +
          (p1.position.z - p2.position.z) ** 2
        );
        
        if (distance < this.constraints.minPillarSpacing * 0.8) {
          return false; // Too close
        }
      }
    }
    
    return true;
  }
  
  /**
   * Get current state
   */
  getState(): AnnealingState {
    return { ...this.currentState };
  }
  
  /**
   * Get best configuration
   */
  getBestConfiguration(): PillarConfig[] {
    return [...this.currentState.bestPillars];
  }
}

