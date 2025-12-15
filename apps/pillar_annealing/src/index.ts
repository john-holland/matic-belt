/**
 * Main orchestration for LSTM annealing framework for cog-shaped pillar design
 */

import { GoogleMaps3D } from './maps/google-maps-3d';
import { PillarAnnealer } from './optimization/annealer';
import { WindFlowAnalyzer } from './wind/wind-flow';
import { FlowPredictor } from './lstm/flow-predictor';
import { KiteDesigner } from './kites/kite-designer';
import { CogPillarGenerator } from './geometry/cog-pillar';
import {
  Location,
  PillarConfig,
  DesignConstraints,
  WindData,
  FlowField,
  KiteDesign,
  GiantKiteConfig,
  MicroclimateResult
} from './types';
import { MicroclimateDesigner } from './microclimate-designer';
import { WindFarmOptimizer, WindFarmSearchOptions, WindFarmOptimizationResult, WindFarmSite } from './wind-farm/optimizer';

export class PillarDesignFramework {
  private maps: GoogleMaps3D;
  private flowAnalyzer: WindFlowAnalyzer;
  private flowPredictor: FlowPredictor;
  private kiteDesigner: KiteDesigner;
  private annealer: PillarAnnealer | null = null;
  private microclimateDesigner: MicroclimateDesigner;
  private windFarmOptimizer: WindFarmOptimizer;
  
  constructor(googleMapsApiKey: string) {
    this.maps = new GoogleMaps3D({ apiKey: googleMapsApiKey });
    this.flowAnalyzer = new WindFlowAnalyzer({ width: 50, height: 50, depth: 20 });
    this.flowPredictor = new FlowPredictor();
    this.kiteDesigner = new KiteDesigner();
    this.microclimateDesigner = new MicroclimateDesigner(googleMapsApiKey);
    this.windFarmOptimizer = new WindFarmOptimizer(googleMapsApiKey);
  }
  
  /**
   * Main design workflow:
   * 1. Select location on Google Maps
   * 2. Get terrain and wind data
   * 3. Design pillar arrangement with annealing
   * 4. Optimize with LSTM predictions
   * 5. Design kites for the space
   */
  async designPillarsAndKites(
    location: Location,
    constraints: DesignConstraints,
    options: {
      numPillars?: number;
      initialPillars?: PillarConfig[];
      maxIterations?: number;
      kiteMaterial?: 'paper' | 'cloth' | 'silk';
      numKites?: number;
    } = {}
  ): Promise<{
    location: Location;
    terrain: any;
    windData: WindData;
    pillars: PillarConfig[];
    flowField: FlowField;
    kites: KiteDesign[];
    annealingHistory: any[];
  }> {
    console.log('Starting pillar design framework...');
    
    // Step 1: Get terrain data
    console.log('Fetching terrain data...');
    const terrain = await this.maps.getTerrainData(location);
    const windData = await this.maps.estimateWindData(location, terrain);
    
    console.log(`Terrain: elevation=${terrain.elevation}m, slope=${terrain.slope.toFixed(2)}, aspect=${terrain.aspect.toFixed(1)}°`);
    console.log(`Wind: speed=${windData.averageSpeed.toFixed(2)}m/s, direction=${windData.averageDirection.toFixed(1)}°, turbulence=${windData.turbulence.toFixed(2)}`);
    
    // Step 2: Initialize pillars (either provided or generate initial arrangement)
    const numPillars = options.numPillars || 8;
    const initialPillars = options.initialPillars || this.generateInitialPillars(
      numPillars,
      constraints
    );
    
    // Step 3: Set up flow analyzer with proper domain size
    this.flowAnalyzer = new WindFlowAnalyzer({
      width: constraints.buildArea.width,
      height: constraints.buildArea.height,
      depth: constraints.maxPillarHeight * 1.5
    });
    
    // Step 4: Run simulated annealing
    console.log('Running simulated annealing optimization...');
    this.annealer = new PillarAnnealer(
      initialPillars,
      constraints,
      windData,
      this.flowAnalyzer
    );
    
    const annealingHistory: any[] = [];
    const maxIterations = options.maxIterations || 500;
    
    for (let i = 0; i < maxIterations; i++) {
      const state = await this.annealer.step();
      
      if (i % 50 === 0) {
        console.log(`Iteration ${i}: energy=${state.energy.toFixed(2)}, temp=${state.temperature.toFixed(2)}`);
        annealingHistory.push({
          iteration: i,
          energy: state.energy,
          temperature: state.temperature
        });
      }
      
      // Early stopping if converged
      if (state.temperature < 0.1 && i > 100) {
        break;
      }
    }
    
    const finalState = this.annealer.getState();
    const optimizedPillars = finalState.pillars;
    const optimizedFlowField = finalState.flowField;
    
    console.log(`Optimization complete. Final energy: ${finalState.energy.toFixed(2)}`);
    
    // Step 5: Train LSTM on flow history (if we have enough data)
    // For now, we'll use the flow predictor for future predictions
    
    // Step 6: Design kites for the optimized space
    console.log('Designing kites...');
    const kites = this.kiteDesigner.designKitesForSpace(
      optimizedFlowField,
      windData,
      optimizedPillars,
      options.kiteMaterial || 'cloth',
      options.numKites || 5
    );
    
    console.log(`Designed ${kites.length} kites`);
    
    return {
      location,
      terrain,
      windData,
      pillars: optimizedPillars,
      flowField: optimizedFlowField,
      kites,
      annealingHistory
    };
  }
  
  /**
   * Generate initial pillar arrangement
   */
  private generateInitialPillars(
    count: number,
    constraints: DesignConstraints
  ): PillarConfig[] {
    const pillars: PillarConfig[] = [];
    const { width, height } = constraints.buildArea;
    
    // Generate pillars in a grid pattern
    const cols = Math.ceil(Math.sqrt(count));
    const rows = Math.ceil(count / cols);
    const spacingX = width / (cols + 1);
    const spacingY = height / (rows + 1);
    
    for (let i = 0; i < count; i++) {
      const col = i % cols;
      const row = Math.floor(i / cols);
      
      const x = -width / 2 + (col + 1) * spacingX + (Math.random() - 0.5) * spacingX * 0.3;
      const z = -height / 2 + (row + 1) * spacingY + (Math.random() - 0.5) * spacingY * 0.3;
      
      const pillarHeight = constraints.minPillarHeight +
        Math.random() * (constraints.maxPillarHeight - constraints.minPillarHeight);
      
      pillars.push({
        position: { x, y: 0, z },
        height: pillarHeight,
        radius: 1.0 + Math.random() * 0.5,
        cogTeeth: 8 + Math.floor(Math.random() * 8),
        toothDepth: 0.1 + Math.random() * 0.2,
        rotation: Math.random() * Math.PI * 2,
        material: 'stone'
      });
    }
    
    return pillars;
  }
  
  /**
   * Find optimal location (sheltered from wind)
   */
  async findOptimalLocation(
    centerLocation: Location,
    searchRadius: number = 5000
  ): Promise<Location[]> {
    return await this.maps.findShelteredLocations(centerLocation, searchRadius);
  }
  
  /**
   * Get visualization data for rendering
   */
  getVisualizationData(
    pillars: PillarConfig[],
    flowField: FlowField,
    kites: KiteDesign[]
  ) {
    return {
      pillars: pillars.map(p => ({
        ...p,
        geometry: CogPillarGenerator.generatePillar(p)
      })),
      flowField,
      kites: kites.map((kite, i) => ({
        ...kite,
        mesh: this.kiteDesigner.createKiteMesh(kite, { x: 0, y: 0, z: 0 })
      }))
    };
  }
  
  /**
   * Design structures to enhance fertility through microclimate modification
   */
  async designForFertilityEnhancement(
    location: Location,
    structures: GiantKiteConfig[] | PillarConfig[],
    options: {
      targetArea?: { width: number; height: number };
      baseSoilConditions?: any;
      baseClimate?: any;
    } = {}
  ): Promise<MicroclimateResult> {
    return await this.microclimateDesigner.designForFertility(
      location,
      structures,
      options
    );
  }
  
  /**
   * Optimize structure placement for maximum fertility enhancement
   */
  async optimizeForFertility(
    location: Location,
    structureCount: number,
    structureType: 'kite' | 'mountain',
    targetArea: { width: number; height: number },
    constraints: {
      minSpacing?: number;
      maxHeight?: number;
      minHeight?: number;
    } = {}
  ): Promise<{
    structures: GiantKiteConfig[];
    result: MicroclimateResult;
  }> {
    return await this.microclimateDesigner.optimizeStructurePlacement(
      location,
      structureCount,
      structureType,
      targetArea,
      constraints
    );
  }
  
  /**
   * Search for optimal wind farm locations
   */
  async findOptimalWindFarmSites(
    options: WindFarmSearchOptions
  ): Promise<WindFarmOptimizationResult> {
    return await this.windFarmOptimizer.findOptimalWindFarmSites(options);
  }
  
  /**
   * Design pillars for a specific wind farm site
   */
  async designPillarsForWindFarm(
    site: WindFarmSite,
    farmType: 'kite' | 'propeller',
    constraints?: Partial<DesignConstraints>
  ): Promise<{
    pillars: PillarConfig[];
    flowField: FlowField;
    optimizationNotes: string[];
  }> {
    return await this.windFarmOptimizer.designPillarsForWindFarm(
      site,
      farmType,
      constraints
    );
  }
}

// Export main class
export default PillarDesignFramework;

