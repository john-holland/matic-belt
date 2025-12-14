/**
 * Microclimate designer - designs structures to enhance humidity and fertility
 */

import { GoogleMaps3D } from './maps/google-maps-3d';
import { LakeEffectCalculator, Structure, AtmosphericState, PrecipitationField } from './microclimate/lake-effect';
import { OrographicLiftCalculator, MountainStructure } from './microclimate/orographic-lift';
import { FertilityCalculator, SoilConditions, ClimateData, FertilityAssessment } from './microclimate/fertility-calculator';
import { Location, WindData, GiantKiteConfig, MicroclimateResult } from './types';
import { PillarConfig } from './types';

export class MicroclimateDesigner {
  private maps: GoogleMaps3D;
  private lakeEffectCalc: LakeEffectCalculator;
  private orographicCalc: OrographicLiftCalculator;
  private fertilityCalc: FertilityCalculator;
  
  constructor(googleMapsApiKey: string) {
    this.maps = new GoogleMaps3D({ apiKey: googleMapsApiKey });
    this.lakeEffectCalc = new LakeEffectCalculator({ width: 100, height: 100, depth: 50 });
    this.orographicCalc = new OrographicLiftCalculator();
    this.fertilityCalc = new FertilityCalculator();
  }
  
  /**
   * Design structures to enhance fertility through humidity and precipitation
   */
  async designForFertility(
    location: Location,
    structures: GiantKiteConfig[] | PillarConfig[],
    options: {
      targetArea?: { width: number; height: number };
      baseSoilConditions?: Partial<SoilConditions>;
      baseClimate?: Partial<ClimateData>;
    } = {}
  ): Promise<MicroclimateResult> {
    console.log('Designing microclimate for fertility enhancement...');
    
    // Get terrain and wind data
    const terrain = await this.maps.getTerrainData(location);
    const windData = await this.maps.estimateWindData(location, terrain);
    
    // Set up domain size
    const targetArea = options.targetArea || { width: 100, height: 100 };
    this.lakeEffectCalc = new LakeEffectCalculator({
      width: targetArea.width,
      height: targetArea.height,
      depth: 50
    });
    
    // Convert structures to common format
    const structuresArray = this.convertStructures(structures);
    
    // Estimate base atmospheric state
    const baseAtmosphericState = this.estimateBaseAtmosphericState(location, terrain, windData);
    
    // Calculate lake effect / orographic lift
    const precipitationField = this.lakeEffectCalc.calculateLakeEffect(
      structuresArray,
      baseAtmosphericState,
      windData
    );
    
    // Calculate humidity enhancement
    const humidityEnhancement = this.lakeEffectCalc.calculateHumidityEnhancement(
      precipitationField,
      baseAtmosphericState.humidity
    );
    
    // Calculate orographic effects (for mountain structures)
    const mountainStructures = structuresArray.filter(s => s.type === 'mountain') as MountainStructure[];
    if (mountainStructures.length > 0) {
      // Enhance mountain structures with profile data
      const enhancedMountains = mountainStructures.map(s => ({
        ...s,
        slope: Math.atan(s.height / s.width),
        profile: this.generateMountainProfile(s)
      }));
      
      const orographicEffects = this.orographicCalc.calculateOrographicLift(
        enhancedMountains,
        windData,
        baseAtmosphericState
      );
      
      // Combine orographic precipitation with lake effect
      const orographicPrecip = this.orographicCalc.calculateTotalPrecipitationEnhancement(
        orographicEffects,
        enhancedMountains,
        baseAtmosphericState,
        targetArea
      );
      
      console.log(`Orographic enhancement factor: ${orographicPrecip.enhancementFactor.toFixed(2)}x`);
    }
    
    // Calculate soil moisture
    const baseSoilConditions: SoilConditions = {
      moisture: 0.3,
      organicMatter: 0.5,
      drainage: 0.7,
      ph: 6.5,
      nutrients: {
        nitrogen: 0.5,
        phosphorus: 0.5,
        potassium: 0.5
      },
      ...options.baseSoilConditions
    };
    
    const soilMoistureMap = this.fertilityCalc.calculateSoilMoisture(
      precipitationField,
      baseSoilConditions.moisture,
      baseSoilConditions.drainage
    );
    
    // Average soil moisture
    const avgMoisture = Array.from(soilMoistureMap.values()).reduce((a, b) => a + b, 0) / soilMoistureMap.size;
    const enhancedSoilConditions: SoilConditions = {
      ...baseSoilConditions,
      moisture: avgMoisture
    };
    
    // Calculate base climate data
    const baseClimate: ClimateData = {
      averageTemperature: baseAtmosphericState.temperature,
      averageHumidity: baseAtmosphericState.humidity,
      precipitation: 500, // mm/year baseline
      growingSeasonLength: 180, // days
      ...options.baseClimate
    };
    
    // Enhanced climate (with structures)
    const annualPrecipitation = this.calculateAnnualPrecipitation(
      precipitationField,
      targetArea
    );
    const enhancedClimate: ClimateData = {
      ...baseClimate,
      averageHumidity: humidityEnhancement.averageHumidity,
      precipitation: annualPrecipitation
    };
    
    // Calculate fertility assessments
    const baseFertility = this.fertilityCalc.calculateFertility(
      baseSoilConditions,
      baseClimate,
      this.createEmptyPrecipitationField(),
      location
    );
    
    const enhancedFertility = this.fertilityCalc.calculateFertility(
      enhancedSoilConditions,
      enhancedClimate,
      precipitationField,
      location
    );
    
    // Calculate enhancement factor
    const enhancementFactor = this.fertilityCalc.calculateEnhancementFactor(
      baseFertility,
      enhancedFertility
    );
    
    console.log(`Fertility improvement: ${enhancementFactor.overallImprovement}`);
    console.log(`Humidity enhancement: ${humidityEnhancement.enhancementFactor.toFixed(2)}x`);
    console.log(`Precipitation: ${annualPrecipitation.toFixed(0)} mm/year`);
    
    return {
      precipitationField,
      humidityEnhancement,
      fertilityAssessment: enhancedFertility,
      enhancementFactor
    };
  }
  
  /**
   * Convert various structure types to common Structure format
   */
  private convertStructures(structures: GiantKiteConfig[] | PillarConfig[]): Structure[] {
    return structures.map((s: any) => {
      if ('cogTeeth' in s) {
        // PillarConfig
        return {
          position: s.position,
          height: s.height,
          width: s.radius * 2,
          type: 'pillar' as const,
          surfaceArea: Math.PI * s.radius ** 2 + 2 * Math.PI * s.radius * s.height
        };
      } else {
        // GiantKiteConfig
        return {
          position: s.position,
          height: s.height,
          width: s.width,
          type: s.type === 'mountain' ? 'mountain' as const : 'kite' as const,
          surfaceArea: s.surfaceArea
        };
      }
    });
  }
  
  /**
   * Estimate base atmospheric state from location and terrain
   */
  private estimateBaseAtmosphericState(
    location: Location,
    terrain: any,
    windData: WindData
  ): AtmosphericState {
    // Simplified estimation
    const baseTemp = 288; // K (15°C) at sea level
    const elevation = terrain.elevation || 0;
    
    // Temperature decreases with altitude (~6.5 K/km)
    const temperature = baseTemp - (elevation / 1000) * 6.5;
    
    // Base humidity (can vary widely, use typical value)
    const baseHumidity = 0.5; // 50% relative humidity
    
    // Base pressure (barometric formula)
    const basePressure = 101325; // Pa at sea level
    const pressure = basePressure * Math.exp(-elevation / 8500);
    
    // Calculate absolute humidity (water vapor density)
    const saturationVaporPressure = 611.2 * Math.exp((17.67 * (temperature - 273.15)) / (temperature - 29.65));
    const vaporPressure = baseHumidity * saturationVaporPressure;
    const R_v = 461.5; // J/(kg·K)
    const waterVapor = vaporPressure / (R_v * temperature);
    
    return {
      temperature,
      humidity: baseHumidity,
      pressure,
      waterVapor
    };
  }
  
  /**
   * Generate mountain profile for orographic calculations
   */
  private generateMountainProfile(structure: Structure): Array<{ x: number; z: number; height: number }> {
    // Simplified mountain profile (cone shape)
    const profile: Array<{ x: number; z: number; height: number }> = [];
    const steps = 10;
    
    for (let i = 0; i <= steps; i++) {
      const angle = (i / steps) * Math.PI * 2;
      const radius = (structure.width / 2) * (1 - i / steps);
      const height = structure.height * (1 - i / steps);
      
      profile.push({
        x: structure.position.x + radius * Math.cos(angle),
        z: structure.position.z + radius * Math.sin(angle),
        height: structure.position.y + height
      });
    }
    
    return profile;
  }
  
  /**
   * Calculate annual precipitation from precipitation field
   */
  private calculateAnnualPrecipitation(
    precipField: PrecipitationField,
    area: { width: number; height: number }
  ): number {
    // Sum precipitation rates (assumed mm/hour)
    // Convert to annual (mm/year)
    const hoursPerYear = 365.25 * 24;
    
    let totalPrecip = 0;
    let count = 0;
    
    for (let i = 0; i < precipField.points.length; i++) {
      const point = precipField.points[i];
      if (Math.abs(point.y) < 1) { // Ground level
        totalPrecip += precipField.precipitationRate[i];
        count++;
      }
    }
    
    const avgHourlyPrecip = count > 0 ? totalPrecip / count : 0;
    
    // Assume precipitation occurs during 20% of hours (realistic)
    const annualPrecip = avgHourlyPrecip * hoursPerYear * 0.2;
    
    return annualPrecip;
  }
  
  /**
   * Create empty precipitation field for baseline comparison
   */
  private createEmptyPrecipitationField(): PrecipitationField {
    return {
      points: [],
      precipitationRate: [],
      cloudCover: [],
      relativeHumidity: []
    };
  }
  
  /**
   * Optimize structure placement for maximum fertility enhancement
   */
  async optimizeStructurePlacement(
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
    console.log(`Optimizing ${structureCount} ${structureType} structures...`);
    
    // Get terrain and wind data
    const terrain = await this.maps.getTerrainData(location);
    const windData = await this.maps.estimateWindData(location, terrain);
    
    // Simple grid-based optimization
    const spacing = constraints.minSpacing || 20;
    const cols = Math.ceil(Math.sqrt(structureCount));
    const rows = Math.ceil(structureCount / cols);
    
    const structures: GiantKiteConfig[] = [];
    
    for (let i = 0; i < structureCount; i++) {
      const col = i % cols;
      const row = Math.floor(i / cols);
      
      const x = -targetArea.width / 2 + (col + 1) * (targetArea.width / (cols + 1));
      const z = -targetArea.height / 2 + (row + 1) * (targetArea.height / (rows + 1));
      
      const height = constraints.minHeight || 50 + (constraints.maxHeight ? 
        Math.random() * (constraints.maxHeight - (constraints.minHeight || 50)) : 0);
      
      structures.push({
        position: { x, y: 0, z },
        height,
        width: height * 0.5, // Proportional width
        surfaceArea: height * height * 0.5,
        type: structureType,
        material: structureType === 'kite' ? 'synthetic' : 'cloth'
      });
    }
    
    // Calculate fertility result
    const result = await this.designForFertility(location, structures, {
      targetArea
    });
    
    return {
      structures,
      result
    };
  }
}

