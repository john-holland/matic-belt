/**
 * Lake effect calculator for large structures (kites, mountains, pillars)
 * Simulates how structures affect atmospheric moisture and precipitation patterns
 */

import { Location, WindData, FlowField } from '../types';
import * as THREE from 'three';

export interface AtmosphericState {
  temperature: number; // Kelvin
  humidity: number; // 0-1, relative humidity
  pressure: number; // Pa
  waterVapor: number; // kg/m³, absolute humidity
}

export interface PrecipitationField {
  points: Array<{ x: number; y: number; z: number }>;
  precipitationRate: number[]; // mm/hour
  cloudCover: number[]; // 0-1
  relativeHumidity: number[]; // 0-1
}

export interface Structure {
  position: { x: number; y: number; z: number };
  height: number;
  width: number; // effective width for blocking/intercepting air
  type: 'kite' | 'mountain' | 'pillar';
  surfaceArea: number; // m², for heat/moisture exchange
  temperature?: number; // Kelvin, surface temperature
}

export class LakeEffectCalculator {
  private resolution: number = 50;
  private domainSize: { width: number; height: number; depth: number };
  
  constructor(domainSize: { width: number; height: number; depth: number }) {
    this.domainSize = domainSize;
  }
  
  /**
   * Calculate lake effect from structures
   * Analogous to lake effect: air picks up moisture, is lifted, cools, and precipitates
   */
  calculateLakeEffect(
    structures: Structure[],
    upstreamState: AtmosphericState,
    windData: WindData,
    baseTemperature: number = 288 // K (15°C)
  ): PrecipitationField {
    const { width, height, depth } = this.domainSize;
    const stepX = width / this.resolution;
    const stepY = height / this.resolution;
    const stepZ = depth / this.resolution;
    
    const points: Array<{ x: number; y: number; z: number }> = [];
    const precipitationRate: number[] = [];
    const cloudCover: number[] = [];
    const relativeHumidity: number[] = [];
    
    // Calculate wind direction vector
    const windDirRad = (windData.averageDirection * Math.PI) / 180;
    const windVector = new THREE.Vector3(
      Math.sin(windDirRad),
      0,
      -Math.cos(windDirRad)
    ).normalize();
    
    // Generate grid points
    for (let i = 0; i < this.resolution; i++) {
      for (let j = 0; j < this.resolution; j++) {
        for (let k = 0; k < this.resolution; k++) {
          const x = -width / 2 + i * stepX;
          const y = j * stepY;
          const z = -depth / 2 + k * stepZ;
          
          const point = new THREE.Vector3(x, y, z);
          points.push({ x, y, z });
          
          // Calculate atmospheric state at this point
          const atmState = this.calculateAtmosphericState(
            point,
            structures,
            upstreamState,
            windData,
            windVector,
            baseTemperature
          );
          
          relativeHumidity.push(atmState.humidity);
          
          // Calculate cloud cover (increases with humidity and lifting)
          const lifting = this.calculateLifting(point, structures, windVector, windData);
          const cloud = Math.min(1, atmState.humidity * 0.8 + lifting * 0.6);
          cloudCover.push(cloud);
          
          // Calculate precipitation rate
          // Precipitation occurs when:
          // 1. Humidity is high (>80%)
          // 2. Air is lifted (cooling causes condensation)
          // 3. Water vapor content is sufficient
          const precip = this.calculatePrecipitation(
            atmState,
            lifting,
            upstreamState,
            windData.averageSpeed
          );
          precipitationRate.push(precip);
        }
      }
    }
    
    return {
      points,
      precipitationRate,
      cloudCover,
      relativeHumidity
    };
  }
  
  /**
   * Calculate atmospheric state at a point considering structure effects
   */
  private calculateAtmosphericState(
    point: THREE.Vector3,
    structures: Structure[],
    upstreamState: AtmosphericState,
    windData: WindData,
    windVector: THREE.Vector3,
    baseTemperature: number
  ): AtmosphericState {
    let temperature = upstreamState.temperature;
    let humidity = upstreamState.humidity;
    let waterVapor = upstreamState.waterVapor;
    
    // Check if point is downstream from any structure
    for (const structure of structures) {
      const structPos = new THREE.Vector3(
        structure.position.x,
        structure.position.y,
        structure.position.z
      );
      
      const toPoint = point.clone().sub(structPos);
      const distance = toPoint.length();
      const maxInfluence = structure.height * 10; // influence radius
      
      if (distance < maxInfluence) {
        // Check if point is in wake/lee of structure
        const windRelative = toPoint.clone().normalize();
        const dotProduct = windVector.dot(windRelative);
        
        if (dotProduct > 0.3) { // Downstream
          const influence = 1 - (distance / maxInfluence);
          
          // Structures can add moisture (if they're "wet" like lakes)
          // Kites/mountains can intercept clouds and cause orographic lift
          
          // Orographic effect: air lifted by structure cools adiabatically
          // Dry adiabatic lapse rate: ~9.8 K/km
          // Moist adiabatic lapse rate: ~5 K/km (when condensation occurs)
          const lifting = this.calculateLifting(point, [structure], windVector, windData);
          
          if (lifting > 0) {
            // Air cools as it rises
            const coolingRate = humidity > 0.7 ? 5 : 9.8; // K/km
            const heightLifted = lifting * structure.height; // approximate
            temperature -= (heightLifted / 1000) * coolingRate;
            
            // As air cools, relative humidity increases
            // At saturation, condensation occurs and humidity can exceed 100% (overcast)
            const saturationVaporPressure = this.calculateSaturationVaporPressure(temperature);
            const currentVaporPressure = this.calculateVaporPressure(waterVapor, temperature);
            
            if (currentVaporPressure >= saturationVaporPressure) {
              // Condensation occurs - clouds form
              humidity = Math.min(1.2, humidity * (1 + influence * 0.3)); // Can exceed 100% temporarily
              
              // Excess water vapor condenses into precipitation
              const excessVapor = currentVaporPressure - saturationVaporPressure;
              waterVapor = this.vaporPressureToAbsolute(saturationVaporPressure, temperature);
            } else {
              humidity = currentVaporPressure / saturationVaporPressure;
            }
          }
          
          // Evaporation from structures (if they act like lakes)
          // Kites could have water collection systems, mountains could have snowmelt
          if (structure.type === 'mountain' || structure.surfaceArea > 1000) {
            // Structures can add moisture to air
            const evaporationRate = influence * 0.001; // kg/m³ per structure
            waterVapor += evaporationRate;
            humidity = Math.min(1, humidity + influence * 0.1);
          }
        }
      }
    }
    
    // Adiabatic cooling with altitude
    const altitude = point.y;
    const lapseRate = humidity > 0.7 ? 5 : 9.8; // K/km
    temperature -= (altitude / 1000) * lapseRate;
    
    // Recalculate humidity at new temperature
    const saturationVaporPressure = this.calculateSaturationVaporPressure(temperature);
    const currentVaporPressure = this.calculateVaporPressure(waterVapor, temperature);
    humidity = Math.min(1, currentVaporPressure / saturationVaporPressure);
    
    return {
      temperature,
      humidity,
      pressure: upstreamState.pressure * Math.exp(-altitude / 8500), // barometric formula
      waterVapor
    };
  }
  
  /**
   * Calculate lifting (vertical motion) caused by structures
   */
  private calculateLifting(
    point: THREE.Vector3,
    structures: Structure[],
    windVector: THREE.Vector3,
    windData: WindData
  ): number {
    let totalLifting = 0;
    
    for (const structure of structures) {
      const structPos = new THREE.Vector3(
        structure.position.x,
        structure.position.y,
        structure.position.z
      );
      
      const toPoint = point.clone().sub(structPos);
      const distance = toPoint.length();
      const horizontalDistance = Math.sqrt(toPoint.x ** 2 + toPoint.z ** 2);
      
      // Orographic lift: wind hitting structure is forced upward
      if (horizontalDistance < structure.width * 2) {
        // Check if wind is hitting structure
        const windRelative = new THREE.Vector3(toPoint.x, 0, toPoint.z).normalize();
        const dotProduct = windVector.dot(windRelative);
        
        if (dotProduct < -0.3) { // Windward side
          // Lifting strength decreases with distance
          const influence = Math.max(0, 1 - horizontalDistance / (structure.width * 2));
          
          // Lifting is stronger with taller structures and faster winds
          const liftingStrength = (structure.height / 100) * (windData.averageSpeed / 10) * influence;
          totalLifting = Math.max(totalLifting, liftingStrength);
        }
      }
    }
    
    return Math.min(1, totalLifting); // Normalize to 0-1
  }
  
  /**
   * Calculate precipitation rate
   */
  private calculatePrecipitation(
    atmState: AtmosphericState,
    lifting: number,
    upstreamState: AtmosphericState,
    windSpeed: number
  ): number {
    // Precipitation requires:
    // 1. High humidity (saturation)
    // 2. Lifting (cooling causes condensation)
    // 3. Sufficient water vapor
    
    if (atmState.humidity < 0.8 || lifting < 0.1) {
      return 0;
    }
    
    // Base precipitation rate increases with humidity and lifting
    const saturationFactor = Math.max(0, (atmState.humidity - 0.8) / 0.2); // 0-1 above 80% RH
    const liftingFactor = lifting;
    
    // Wind speed affects how quickly moisture is transported
    const transportFactor = Math.min(1, windSpeed / 15);
    
    // Maximum precipitation rate (mm/hour)
    // Lake effect can produce 5-10 mm/hour, orographic can produce 10-20+ mm/hour
    const maxPrecipRate = 15; // mm/hour
    
    const precipRate = maxPrecipRate * saturationFactor * liftingFactor * transportFactor;
    
    return precipRate;
  }
  
  /**
   * Calculate saturation vapor pressure (Clausius-Clapeyron approximation)
   */
  private calculateSaturationVaporPressure(temperature: number): number {
    // Simplified Clausius-Clapeyron equation
    // P_sat = 611.2 * exp((17.67 * (T - 273.15)) / (T - 29.65))
    const T_c = temperature - 273.15; // Convert to Celsius
    const P_sat = 611.2 * Math.exp((17.67 * T_c) / (T_c + 243.5));
    return P_sat; // Pa
  }
  
  /**
   * Calculate vapor pressure from absolute humidity
   */
  private calculateVaporPressure(waterVapor: number, temperature: number): number {
    // P_v = (waterVapor * R_v * T) where R_v = 461.5 J/(kg·K)
    const R_v = 461.5;
    return waterVapor * R_v * temperature; // Pa
  }
  
  /**
   * Convert vapor pressure to absolute humidity
   */
  private vaporPressureToAbsolute(vaporPressure: number, temperature: number): number {
    const R_v = 461.5;
    return vaporPressure / (R_v * temperature); // kg/m³
  }
  
  /**
   * Calculate total precipitation in a region
   */
  calculateTotalPrecipitation(precipField: PrecipitationField, area: { width: number; height: number }): number {
    // Integrate precipitation over area and time
    // Assume 1 hour duration for rate
    let totalPrecip = 0;
    const gridArea = (area.width / this.resolution) * (area.height / this.resolution);
    
    // Sample ground-level points (y=0)
    for (let i = 0; i < precipField.points.length; i++) {
      const point = precipField.points[i];
      if (Math.abs(point.y) < 1) { // Ground level
        totalPrecip += precipField.precipitationRate[i] * gridArea; // mm·m²
      }
    }
    
    // Convert to total volume (m³) for the area
    return totalPrecip / 1000; // Convert mm to m
  }
  
  /**
   * Calculate humidity enhancement factor
   */
  calculateHumidityEnhancement(
    precipField: PrecipitationField,
    upstreamHumidity: number
  ): { averageHumidity: number; enhancementFactor: number; maxHumidity: number } {
    const humidities = precipField.relativeHumidity;
    const averageHumidity = humidities.reduce((a, b) => a + b, 0) / humidities.length;
    const maxHumidity = Math.max(...humidities);
    
    const enhancementFactor = averageHumidity / upstreamHumidity;
    
    return {
      averageHumidity,
      enhancementFactor,
      maxHumidity
    };
  }
}

