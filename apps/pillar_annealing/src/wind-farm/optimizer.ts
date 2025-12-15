/**
 * Wind farm optimizer - finds optimal locations for kite-based and propeller-based wind farms
 */

import { GoogleMaps3D } from '../maps/google-maps-3d';
import { WindFlowAnalyzer } from '../wind/wind-flow';
import { Location, WindData, PillarConfig, DesignConstraints } from '../types';

export type WindFarmType = 'kite' | 'propeller';

export interface WindFarmSite {
  location: Location;
  score: number;
  metrics: {
    averageWindSpeed: number;
    windConsistency: number; // 0-1, how consistent wind is
    altitude: number;
    terrainSuitability: number; // 0-1
    accessibility: number; // 0-1, ease of access
    areaSize: number; // m², available area
    estimatedPowerOutput?: number; // MW
  };
  recommendedPillarCount: number;
  recommendedSpacing: number; // meters
}

export interface WindFarmSearchOptions {
  centerLocation: Location;
  searchRadius: number; // meters
  gridResolution?: number; // points per dimension
  minWindSpeed?: number; // m/s
  minAreaSize?: number; // m²
  farmType: WindFarmType;
  targetPowerOutput?: number; // MW
}

export interface WindFarmOptimizationResult {
  topSites: WindFarmSite[];
  analysis: {
    totalSitesEvaluated: number;
    averageWindSpeed: number;
    bestSite: WindFarmSite;
    recommendations: string[];
  };
}

export class WindFarmOptimizer {
  private maps: GoogleMaps3D;
  
  constructor(googleMapsApiKey: string) {
    this.maps = new GoogleMaps3D({ apiKey: googleMapsApiKey });
  }
  
  /**
   * Search for optimal wind farm locations
   */
  async findOptimalWindFarmSites(
    options: WindFarmSearchOptions
  ): Promise<WindFarmOptimizationResult> {
    const {
      centerLocation,
      searchRadius,
      gridResolution = 20,
      minWindSpeed = 4, // m/s minimum
      minAreaSize = 10000, // 1 hectare minimum
      farmType,
      targetPowerOutput
    } = options;
    
    console.log(`Searching for ${farmType} wind farm sites...`);
    console.log(`Search radius: ${searchRadius}m, Resolution: ${gridResolution}x${gridResolution}`);
    
    // Generate grid of candidate locations
    const candidateLocations = this.generateSearchGrid(
      centerLocation,
      searchRadius,
      gridResolution
    );
    
    console.log(`Evaluating ${candidateLocations.length} candidate locations...`);
    
    // Evaluate each location
    const sites: WindFarmSite[] = [];
    
    for (const location of candidateLocations) {
      try {
        const site = await this.evaluateSite(location, farmType, minAreaSize);
        if (site && site.metrics.averageWindSpeed >= minWindSpeed) {
          sites.push(site);
        }
      } catch (error) {
        console.warn(`Error evaluating location ${location.lat}, ${location.lng}:`, error);
        continue;
      }
    }
    
    // Sort by score
    sites.sort((a, b) => b.score - a.score);
    
    // Take top sites
    const topSites = sites.slice(0, 10);
    
    // Calculate recommendations
    const recommendations = this.generateRecommendations(
      topSites,
      farmType,
      targetPowerOutput
    );
    
    // Calculate analysis metrics
    const averageWindSpeed = sites.reduce((sum, s) => sum + s.metrics.averageWindSpeed, 0) / sites.length;
    
    return {
      topSites,
      analysis: {
        totalSitesEvaluated: sites.length,
        averageWindSpeed,
        bestSite: topSites[0] || sites[0],
        recommendations
      }
    };
  }
  
  /**
   * Generate grid of candidate locations
   */
  private generateSearchGrid(
    center: Location,
    radius: number,
    resolution: number
  ): Location[] {
    const locations: Location[] = [];
    
    // Convert radius to degrees (approximate)
    const latDelta = radius / 111000; // 1 degree ≈ 111km
    const lngDelta = radius / (111000 * Math.cos(center.lat * Math.PI / 180));
    
    const stepLat = (2 * latDelta) / resolution;
    const stepLng = (2 * lngDelta) / resolution;
    
    for (let i = 0; i < resolution; i++) {
      for (let j = 0; j < resolution; j++) {
        const lat = center.lat - latDelta + i * stepLat;
        const lng = center.lng - lngDelta + j * stepLng;
        
        locations.push({ lat, lng });
      }
    }
    
    return locations;
  }
  
  /**
   * Evaluate a site for wind farm suitability
   */
  private async evaluateSite(
    location: Location,
    farmType: WindFarmType,
    minAreaSize: number
  ): Promise<WindFarmSite | null> {
    // Get terrain data
    const terrain = await this.maps.getTerrainData(location, 500); // 500m sample radius
    const windData = await this.maps.estimateWindData(location, terrain);
    
    // Calculate site-specific metrics
    const metrics = await this.calculateSiteMetrics(
      location,
      terrain,
      windData,
      farmType
    );
    
    // Check minimum area
    if (metrics.areaSize < minAreaSize) {
      return null;
    }
    
    // Calculate overall score
    const score = this.calculateSiteScore(metrics, farmType);
    
    // Estimate power output if possible
    const estimatedPowerOutput = this.estimatePowerOutput(metrics, farmType);
    
    // Recommend pillar count and spacing
    const { pillarCount, spacing } = this.recommendPillarConfiguration(
      metrics,
      farmType
    );
    
    return {
      location,
      score,
      metrics: {
        ...metrics,
        estimatedPowerOutput
      },
      recommendedPillarCount: pillarCount,
      recommendedSpacing: spacing
    };
  }
  
  /**
   * Calculate site-specific metrics
   */
  private async calculateSiteMetrics(
    location: Location,
    terrain: any,
    windData: WindData,
    farmType: WindFarmType
  ): Promise<WindFarmSite['metrics']> {
    // Base metrics
    const averageWindSpeed = windData.averageSpeed;
    const altitude = terrain.elevation || 0;
    
    // Wind consistency (inverse of turbulence)
    const windConsistency = 1 - windData.turbulence;
    
    // Terrain suitability depends on farm type
    let terrainSuitability = 0.5;
    
    if (farmType === 'kite') {
      // Kites prefer:
      // - Higher altitudes (more wind)
      // - Flatter terrain (easier ground operations)
      // - Open areas (clear airspace)
      const altitudeBonus = Math.min(1, altitude / 1000); // Bonus up to 1000m
      const flatnessBonus = 1 - terrain.slope * 2; // Prefer flat (low slope)
      terrainSuitability = (altitudeBonus * 0.4 + Math.max(0, flatnessBonus) * 0.6);
    } else {
      // Propeller turbines prefer:
      // - Hills/ridges (enhanced wind)
      // - Moderate slopes (better wind, accessible)
      // - Valleys can work if oriented correctly
      const slopeBonus = Math.min(1, terrain.slope * 5); // Prefer some slope
      const ridgeBonus = terrain.roughness < 20 ? 0.8 : 0.5; // Prefer ridges
      terrainSuitability = (slopeBonus * 0.5 + ridgeBonus * 0.5);
    }
    
    // Accessibility (simplified - based on slope and elevation)
    // Lower elevation and gentle slopes are more accessible
    const elevationPenalty = Math.min(1, altitude / 500); // Penalty above 500m
    const slopePenalty = terrain.slope;
    const accessibility = Math.max(0.3, 1 - (elevationPenalty * 0.3 + slopePenalty * 0.4));
    
    // Estimate available area (simplified - assumes circular area)
    // For kite farms: need more ground space for operations
    // For propeller farms: need spacing between turbines
    const baseAreaRadius = farmType === 'kite' ? 200 : 150; // meters
    const areaSize = Math.PI * baseAreaRadius ** 2; // m²
    
    return {
      averageWindSpeed,
      windConsistency,
      altitude,
      terrainSuitability,
      accessibility,
      areaSize
    };
  }
  
  /**
   * Calculate overall site score (0-1)
   */
  private calculateSiteScore(
    metrics: WindFarmSite['metrics'],
    farmType: WindFarmType
  ): number {
    let score = 0;
    
    if (farmType === 'kite') {
      // Kite farms weight factors:
      // - Wind speed: 30%
      // - Wind consistency: 25% (important for kites)
      // - Altitude: 15% (higher is better)
      // - Terrain suitability: 15% (flat is better)
      // - Accessibility: 15% (for operations)
      
      const windSpeedScore = Math.min(1, metrics.averageWindSpeed / 15); // Normalize to 15 m/s
      const altitudeScore = Math.min(1, metrics.altitude / 1000);
      
      score = (
        windSpeedScore * 0.30 +
        metrics.windConsistency * 0.25 +
        altitudeScore * 0.15 +
        metrics.terrainSuitability * 0.15 +
        metrics.accessibility * 0.15
      );
    } else {
      // Propeller farms weight factors:
      // - Wind speed: 35% (most important)
      // - Wind consistency: 20%
      // - Terrain suitability: 25% (hills enhance wind)
      // - Accessibility: 20% (maintenance)
      
      const windSpeedScore = Math.min(1, metrics.averageWindSpeed / 12); // Normalize to 12 m/s
      
      score = (
        windSpeedScore * 0.35 +
        metrics.windConsistency * 0.20 +
        metrics.terrainSuitability * 0.25 +
        metrics.accessibility * 0.20
      );
    }
    
    return score;
  }
  
  /**
   * Estimate power output in MW
   */
  private estimatePowerOutput(
    metrics: WindFarmSite['metrics'],
    farmType: WindFarmType
  ): number {
    if (farmType === 'kite') {
      // Kite power estimation (simplified)
      // Assumes average kite power: 2-3 MW per kite system
      // Power scales with wind speed cubed
      const basePowerPerKite = 2.5; // MW
      const windFactor = Math.pow(metrics.averageWindSpeed / 10, 3); // Cubic relationship
      const kiteCount = Math.floor(metrics.areaSize / 50000); // ~1 kite per 5 hectares
      return basePowerPerKite * kiteCount * windFactor * metrics.windConsistency;
    } else {
      // Propeller turbine power estimation
      // Assumes 3-5 MW turbines
      // Power scales with wind speed cubed
      const basePowerPerTurbine = 4.0; // MW
      const windFactor = Math.pow(metrics.averageWindSpeed / 10, 3);
      // Turbine spacing: ~7× rotor diameter (assuming 100m diameter = 700m spacing)
      const turbineCount = Math.floor(Math.sqrt(metrics.areaSize) / 700);
      return basePowerPerTurbine * turbineCount * windFactor * metrics.windConsistency;
    }
  }
  
  /**
   * Recommend pillar configuration for the site
   */
  private recommendPillarConfiguration(
    metrics: WindFarmSite['metrics'],
    farmType: WindFarmType
  ): { pillarCount: number; spacing: number } {
    if (farmType === 'kite') {
      // Kite farms: pillars support tethering points
      // Typically 1-2 pillars per kite system
      // Spacing: ~100-200m for operational space
      const kiteCount = Math.floor(metrics.areaSize / 50000);
      const pillarCount = kiteCount * 1.5; // Average 1.5 pillars per kite
      const spacing = 150; // meters
      
      return {
        pillarCount: Math.max(4, Math.min(20, pillarCount)),
        spacing
      };
    } else {
      // Propeller farms: pillars support turbine towers
      // 1 pillar per turbine
      // Spacing: ~700m (7× rotor diameter for 100m turbines)
      const turbineCount = Math.floor(Math.sqrt(metrics.areaSize) / 700);
      const pillarCount = turbineCount;
      const spacing = 700; // meters
      
      return {
        pillarCount: Math.max(1, Math.min(50, pillarCount)),
        spacing
      };
    }
  }
  
  /**
   * Generate recommendations based on top sites
   */
  private generateRecommendations(
    topSites: WindFarmSite[],
    farmType: WindFarmType,
    targetPowerOutput?: number
  ): string[] {
    const recommendations: string[] = [];
    
    if (topSites.length === 0) {
      recommendations.push('No suitable sites found. Consider expanding search radius or adjusting criteria.');
      return recommendations;
    }
    
    const bestSite = topSites[0];
    
    recommendations.push(`Best site found at (${bestSite.location.lat.toFixed(4)}, ${bestSite.location.lng.toFixed(4)})`);
    recommendations.push(`Average wind speed: ${bestSite.metrics.averageWindSpeed.toFixed(2)} m/s`);
    
    if (bestSite.metrics.estimatedPowerOutput) {
      recommendations.push(`Estimated power output: ${bestSite.metrics.estimatedPowerOutput.toFixed(1)} MW`);
      
      if (targetPowerOutput && bestSite.metrics.estimatedPowerOutput < targetPowerOutput) {
        recommendations.push(`Warning: Site may not meet target output of ${targetPowerOutput} MW. Consider multiple sites or larger area.`);
      }
    }
    
    recommendations.push(`Recommended ${bestSite.recommendedPillarCount} pillars with ${bestSite.recommendedSpacing}m spacing`);
    
    if (farmType === 'kite') {
      recommendations.push('Kite farms require clear airspace - check aviation restrictions');
      recommendations.push('Ensure adequate ground space for kite launching and operations');
    } else {
      recommendations.push('Propeller farms require proper turbine spacing to avoid wake interference');
      recommendations.push('Consider access roads for turbine maintenance');
    }
    
    if (topSites.length > 1) {
      const avgScore = topSites.reduce((sum, s) => sum + s.score, 0) / topSites.length;
      recommendations.push(`${topSites.length} highly-rated sites found (avg score: ${avgScore.toFixed(2)})`);
    }
    
    return recommendations;
  }
  
  /**
   * Design pillar configuration for a specific wind farm site
   */
  async designPillarsForWindFarm(
    site: WindFarmSite,
    farmType: WindFarmType,
    constraints?: Partial<DesignConstraints>
  ): Promise<{
    pillars: PillarConfig[];
    flowField: any;
    optimizationNotes: string[];
  }> {
    const defaultConstraints: DesignConstraints = {
      minPillarSpacing: farmType === 'kite' ? 50 : site.recommendedSpacing * 0.8,
      maxPillarSpacing: farmType === 'kite' ? 200 : site.recommendedSpacing * 1.2,
      minPillarHeight: farmType === 'kite' ? 5 : 50, // Kites: lower, Propellers: taller
      maxPillarHeight: farmType === 'kite' ? 15 : 150,
      buildArea: {
        width: Math.sqrt(site.metrics.areaSize),
        height: Math.sqrt(site.metrics.areaSize)
      },
      windShelter: false,
      windDirection: 0,
      ...constraints
    };
    
    // Generate pillar arrangement
    const pillars: PillarConfig[] = [];
    const spacing = site.recommendedSpacing;
    const count = site.recommendedPillarCount;
    
    // Grid arrangement
    const cols = Math.ceil(Math.sqrt(count));
    const rows = Math.ceil(count / cols);
    
    for (let i = 0; i < count; i++) {
      const col = i % cols;
      const row = Math.floor(i / cols);
      
      const x = -defaultConstraints.buildArea.width / 2 + (col + 1) * (defaultConstraints.buildArea.width / (cols + 1));
      const z = -defaultConstraints.buildArea.height / 2 + (row + 1) * (defaultConstraints.buildArea.height / (rows + 1));
      
      const height = farmType === 'kite' 
        ? 5 + Math.random() * 10  // 5-15m for kites
        : 50 + Math.random() * 100; // 50-150m for turbines
      
      pillars.push({
        position: { x, y: 0, z },
        height,
        radius: farmType === 'kite' ? 1.5 : 3.0, // Larger for turbine towers
        cogTeeth: 12,
        toothDepth: 0.15,
        rotation: Math.random() * Math.PI * 2,
        material: 'concrete' // Concrete for durability
      });
    }
    
    // Analyze flow field
    const flowAnalyzer = new WindFlowAnalyzer({
      width: defaultConstraints.buildArea.width,
      height: defaultConstraints.buildArea.height,
      depth: defaultConstraints.maxPillarHeight * 1.5
    });
    
    const terrain = await this.maps.getTerrainData(site.location);
    const windData = await this.maps.estimateWindData(site.location, terrain);
    const flowField = flowAnalyzer.calculateFlowField(pillars, windData);
    
    const optimizationNotes: string[] = [];
    
    // Check for wake interference (propeller farms)
    if (farmType === 'propeller') {
      const avgSpacing = this.calculateAverageSpacing(pillars);
      if (avgSpacing < site.recommendedSpacing * 0.9) {
        optimizationNotes.push(`Warning: Pillar spacing (${avgSpacing.toFixed(0)}m) may cause wake interference. Recommended: ${site.recommendedSpacing}m`);
      }
    }
    
    // Check wind flow quality
    const flowQuality = flowAnalyzer.calculateFlowQuality(flowField);
    if (flowQuality < 0.6) {
      optimizationNotes.push(`Flow quality is suboptimal (${flowQuality.toFixed(2)}). Consider adjusting pillar arrangement.`);
    } else {
      optimizationNotes.push(`Flow quality is good (${flowQuality.toFixed(2)}).`);
    }
    
    return {
      pillars,
      flowField,
      optimizationNotes
    };
  }
  
  /**
   * Calculate average spacing between pillars
   */
  private calculateAverageSpacing(pillars: PillarConfig[]): number {
    let totalDistance = 0;
    let count = 0;
    
    for (let i = 0; i < pillars.length; i++) {
      for (let j = i + 1; j < pillars.length; j++) {
        const p1 = pillars[i];
        const p2 = pillars[j];
        const distance = Math.sqrt(
          (p1.position.x - p2.position.x) ** 2 +
          (p1.position.z - p2.position.z) ** 2
        );
        totalDistance += distance;
        count++;
      }
    }
    
    return count > 0 ? totalDistance / count : 0;
  }
}

