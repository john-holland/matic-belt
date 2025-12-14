/**
 * Orographic lift calculator for mountain structures
 * Models how mountains/kites force air upward, causing cooling and precipitation
 */

import { Structure, AtmosphericState, PrecipitationField } from './lake-effect';
import { WindData } from '../types';
import * as THREE from 'three';

export interface OrographicEffect {
  liftingRate: number; // m/s, vertical velocity
  coolingRate: number; // K/s
  condensationRate: number; // kg/(m³·s)
  cloudFormationHeight: number; // m, height where clouds form
}

export interface MountainStructure extends Structure {
  slope: number; // radians, average slope angle
  profile: Array<{ x: number; z: number; height: number }>; // mountain profile
}

export class OrographicLiftCalculator {
  /**
   * Calculate orographic lifting from mountain structures
   */
  calculateOrographicLift(
    structures: MountainStructure[],
    windData: WindData,
    upstreamState: AtmosphericState
  ): Map<string, OrographicEffect> {
    const effects = new Map<string, OrographicEffect>();
    
    const windDirRad = (windData.averageDirection * Math.PI) / 180;
    const windSpeed = windData.averageSpeed;
    
    for (const structure of structures) {
      // Calculate wind component perpendicular to mountain face
      // This determines how much air is forced upward
      
      const effect = this.calculateLiftForStructure(
        structure,
        windData,
        upstreamState,
        windDirRad,
        windSpeed
      );
      
      effects.set(`${structure.position.x}-${structure.position.z}`, effect);
    }
    
    return effects;
  }
  
  /**
   * Calculate lifting effect for a single structure
   */
  private calculateLiftForStructure(
    structure: MountainStructure,
    windData: WindData,
    upstreamState: AtmosphericState,
    windDirRad: number,
    windSpeed: number
  ): OrographicEffect {
    // Wind vector
    const windVector = new THREE.Vector3(
      Math.sin(windDirRad),
      0,
      -Math.cos(windDirRad)
    );
    
    // Mountain slope vector (simplified - assumes uniform slope)
    // In reality, would use actual terrain profile
    const slopeAngle = structure.slope;
    const slopeVector = new THREE.Vector3(
      Math.sin(slopeAngle),
      Math.cos(slopeAngle),
      0
    );
    
    // Project wind onto slope - component perpendicular to slope causes lifting
    const windPerpToSlope = windVector.clone().sub(
      windVector.clone().multiplyScalar(windVector.dot(slopeVector))
    );
    
    // Vertical lifting component
    const verticalComponent = Math.abs(windPerpToSlope.y) * windSpeed;
    const liftingRate = verticalComponent * Math.sin(slopeAngle);
    
    // Cooling rate (dry adiabatic lapse rate: ~9.8 K/km = 0.0098 K/m)
    // When condensation occurs, switches to moist lapse rate (~5 K/km)
    const dryLapseRate = 0.0098; // K/m
    const moistLapseRate = 0.005; // K/m
    
    // Use moist lapse rate if humidity is high
    const lapseRate = upstreamState.humidity > 0.7 ? moistLapseRate : dryLapseRate;
    const coolingRate = liftingRate * lapseRate; // K/s
    
    // Condensation occurs when air reaches dew point
    // Simplified: condensation rate proportional to cooling and humidity
    const condensationRate = upstreamState.humidity > 0.8 ? 
      liftingRate * upstreamState.waterVapor * 0.001 : 0; // kg/(m³·s)
    
    // Cloud formation height (where relative humidity reaches 100%)
    // Simplified calculation
    const cloudFormationHeight = this.calculateCloudBase(
      structure.position.y,
      upstreamState,
      liftingRate
    );
    
    return {
      liftingRate,
      coolingRate,
      condensationRate,
      cloudFormationHeight
    };
  }
  
  /**
   * Calculate cloud base height
   */
  private calculateCloudBase(
    baseHeight: number,
    upstreamState: AtmosphericState,
    liftingRate: number
  ): number {
    // Cloud forms when air cools to dew point
    const dewPoint = this.calculateDewPoint(
      upstreamState.temperature,
      upstreamState.humidity
    );
    
    // Calculate height needed to cool to dew point
    const temperatureDrop = upstreamState.temperature - dewPoint;
    const lapseRate = upstreamState.humidity > 0.7 ? 0.005 : 0.0098; // K/m
    
    const heightNeeded = temperatureDrop / lapseRate;
    
    return baseHeight + heightNeeded;
  }
  
  /**
   * Calculate dew point temperature
   */
  private calculateDewPoint(temperature: number, relativeHumidity: number): number {
    // Magnus formula approximation
    const a = 17.27;
    const b = 237.7;
    
    const T_c = temperature - 273.15; // Convert to Celsius
    const alpha = (a * T_c) / (b + T_c) + Math.log(relativeHumidity);
    const T_dp = (b * alpha) / (a - alpha);
    
    return T_dp + 273.15; // Convert back to Kelvin
  }
  
  /**
   * Calculate precipitation intensity from orographic lift
   */
  calculatePrecipitationIntensity(
    effect: OrographicEffect,
    upstreamState: AtmosphericState,
    structureHeight: number
  ): number {
    // Precipitation intensity (mm/hour) depends on:
    // - Lifting rate (more lifting = more precipitation)
    // - Available moisture
    // - Structure height (taller = more lifting)
    
    if (effect.condensationRate < 0.0001) {
      return 0;
    }
    
    // Convert condensation rate to precipitation
    // 1 kg/m³·s ≈ 3.6 mm/hour (rough approximation)
    const baseIntensity = effect.condensationRate * 3600 * 3.6; // mm/hour
    
    // Enhance based on structure height
    const heightFactor = Math.min(2, 1 + structureHeight / 500);
    
    // Enhance based on upstream humidity
    const humidityFactor = Math.min(2, upstreamState.humidity * 1.5);
    
    return baseIntensity * heightFactor * humidityFactor;
  }
  
  /**
   * Calculate total precipitation enhancement
   */
  calculateTotalPrecipitationEnhancement(
    effects: Map<string, OrographicEffect>,
    structures: MountainStructure[],
    upstreamState: AtmosphericState,
    area: { width: number; height: number }
  ): { totalPrecipitation: number; enhancementFactor: number; averageIntensity: number } {
    let totalPrecip = 0;
    let totalIntensity = 0;
    let count = 0;
    
    effects.forEach((effect, key) => {
      const structure = structures.find(s => 
        `${s.position.x}-${s.position.z}` === key
      );
      
      if (structure) {
        const intensity = this.calculatePrecipitationIntensity(
          effect,
          upstreamState,
          structure.height
        );
        
        // Assume structure affects area proportional to its size
        const affectedArea = structure.width * structure.width; // m²
        totalPrecip += intensity * affectedArea / 1000; // Convert mm to m, then to m³
        
        totalIntensity += intensity;
        count++;
      }
    });
    
    const averageIntensity = count > 0 ? totalIntensity / count : 0;
    
    // Compare to baseline precipitation (assume 1 mm/hour without structures)
    const baselinePrecip = 1 * (area.width * area.height) / 1000; // m³
    const enhancementFactor = baselinePrecip > 0 ? totalPrecip / baselinePrecip : 1;
    
    return {
      totalPrecipitation: totalPrecip,
      enhancementFactor,
      averageIntensity
    };
  }
}

