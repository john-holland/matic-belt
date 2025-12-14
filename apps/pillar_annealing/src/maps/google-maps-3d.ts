/**
 * Google Maps 3D API integration for location selection and terrain data
 */

import axios from 'axios';
import { Location, WindData } from '../types';

export interface TerrainData {
  elevation: number;
  slope: number;
  aspect: number; // direction of slope (degrees)
  roughness: number; // surface roughness (affects wind)
}

export interface MapsConfig {
  apiKey: string;
  elevationApiKey?: string;
}

export class GoogleMaps3D {
  private apiKey: string;
  private elevationApiKey: string;
  
  constructor(config: MapsConfig) {
    this.apiKey = config.apiKey;
    this.elevationApiKey = config.elevationApiKey || config.apiKey;
  }
  
  /**
   * Get elevation data for a location
   */
  async getElevation(location: Location): Promise<number> {
    try {
      const url = `https://maps.googleapis.com/maps/api/elevation/json`;
      const response = await axios.get(url, {
        params: {
          locations: `${location.lat},${location.lng}`,
          key: this.elevationApiKey
        }
      });
      
      if (response.data.status === 'OK' && response.data.results.length > 0) {
        return response.data.results[0].elevation;
      }
      
      return 0; // Default elevation
    } catch (error) {
      console.error('Error fetching elevation:', error);
      return 0;
    }
  }
  
  /**
   * Get terrain data for a location (elevation, slope, aspect, roughness)
   */
  async getTerrainData(location: Location, sampleRadius: number = 100): Promise<TerrainData> {
    // Sample points around the location to calculate slope and aspect
    const samples = 8;
    const elevations: number[] = [];
    
    for (let i = 0; i < samples; i++) {
      const angle = (i / samples) * Math.PI * 2;
      const sampleLat = location.lat + (sampleRadius / 111000) * Math.cos(angle);
      const sampleLng = location.lng + (sampleRadius / 111000) * Math.sin(angle);
      
      const elevation = await this.getElevation({ lat: sampleLat, lng: sampleLng });
      elevations.push(elevation);
    }
    
    const centerElevation = elevations[0];
    const avgElevation = elevations.reduce((a, b) => a + b, 0) / elevations.length;
    
    // Calculate slope (simplified)
    const maxElev = Math.max(...elevations);
    const minElev = Math.min(...elevations);
    const slope = (maxElev - minElev) / sampleRadius;
    
    // Calculate aspect (direction of steepest slope)
    let maxGradient = 0;
    let aspect = 0;
    for (let i = 0; i < samples; i++) {
      const nextI = (i + 1) % samples;
      const gradient = Math.abs(elevations[nextI] - elevations[i]);
      if (gradient > maxGradient) {
        maxGradient = gradient;
        aspect = (i / samples) * 360;
      }
    }
    
    // Roughness (variation in elevation)
    const variance = elevations.reduce((sum, e) => sum + (e - avgElevation) ** 2, 0) / elevations.length;
    const roughness = Math.sqrt(variance);
    
    return {
      elevation: centerElevation,
      slope,
      aspect,
      roughness
    };
  }
  
  /**
   * Get wind data for a location (using terrain to estimate wind patterns)
   * Note: For actual wind data, you'd integrate with a weather API
   */
  async estimateWindData(location: Location, terrainData: TerrainData): Promise<WindData> {
    // This is a simplified estimation based on terrain
    // In practice, you'd use a weather API like OpenWeatherMap or similar
    
    // Higher elevations tend to have stronger winds
    const elevationFactor = Math.min(1, terrainData.elevation / 1000);
    
    // Wind direction affected by slope aspect
    const windDirection = (terrainData.aspect + 180) % 360; // Wind flows down slope
    
    // Wind speed estimated from elevation and slope
    const baseSpeed = 5; // m/s
    const speed = baseSpeed + elevationFactor * 5 + terrainData.slope * 10;
    
    // Turbulence from roughness
    const turbulence = Math.min(1, terrainData.roughness / 50);
    
    return {
      direction: windDirection,
      speed,
      averageSpeed: speed,
      averageDirection: windDirection,
      turbulence
    };
  }
  
  /**
   * Find sheltered locations (valleys, behind hills, etc.)
   */
  async findShelteredLocations(
    centerLocation: Location,
    searchRadius: number = 5000
  ): Promise<Location[]> {
    // Sample grid of locations
    const gridSize = 10;
    const step = searchRadius / gridSize;
    const candidates: Array<{ location: Location; shelterScore: number }> = [];
    
    for (let i = -gridSize / 2; i < gridSize / 2; i++) {
      for (let j = -gridSize / 2; j < gridSize / 2; j++) {
        const lat = centerLocation.lat + (i * step) / 111000;
        const lng = centerLocation.lng + (j * step) / 111000;
        
        const location = { lat, lng };
        const terrain = await this.getTerrainData(location);
        
        // Shelter score: lower elevation + surrounded by higher ground
        let shelterScore = 0;
        
        // Check surrounding elevations
        const checkRadius = 200;
        const surroundingSamples = 4;
        let higherGround = 0;
        
        for (let k = 0; k < surroundingSamples; k++) {
          const angle = (k / surroundingSamples) * Math.PI * 2;
          const sampleLat = lat + (checkRadius / 111000) * Math.cos(angle);
          const sampleLng = lng + (checkRadius / 111000) * Math.sin(angle);
          const sampleElevation = await this.getElevation({ lat: sampleLat, lng: sampleLng });
          
          if (sampleElevation > terrain.elevation) {
            higherGround++;
          }
        }
        
        // Higher shelter score for valleys (lower elevation, surrounded by higher ground)
        shelterScore = (surroundingSamples - higherGround) / surroundingSamples;
        shelterScore += (1 - terrain.slope) * 0.5; // Prefer flat areas
        
        candidates.push({ location, shelterScore });
      }
    }
    
    // Sort by shelter score (higher is better)
    candidates.sort((a, b) => b.shelterScore - a.shelterScore);
    
    // Return top 5 locations
    return candidates.slice(0, 5).map(c => c.location);
  }
  
  /**
   * Get static map image URL (for visualization)
   */
  getMapImageUrl(location: Location, zoom: number = 15, size: string = '600x400'): string {
    return `https://maps.googleapis.com/maps/api/staticmap?center=${location.lat},${location.lng}&zoom=${zoom}&size=${size}&key=${this.apiKey}`;
  }
}

