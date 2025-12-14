/**
 * Soil moisture and fertility calculator
 * Estimates agricultural viability based on humidity, precipitation, and soil conditions
 */

import { PrecipitationField, AtmosphericState } from './lake-effect';
import { Location } from '../types';

export interface SoilConditions {
  moisture: number; // 0-1, soil moisture content
  organicMatter: number; // 0-1, organic matter content
  drainage: number; // 0-1, drainage quality (1 = well-drained)
  ph: number; // pH level (typically 4-9)
  nutrients: {
    nitrogen: number; // 0-1
    phosphorus: number; // 0-1
    potassium: number; // 0-1
  };
}

export interface FertilityAssessment {
  overallFertility: number; // 0-1, overall fertility score
  cropSuitability: {
    grains: number; // 0-1
    vegetables: number; // 0-1
    fruits: number; // 0-1
    trees: number; // 0-1
  };
  recommendations: string[];
  limitations: string[];
}

export interface ClimateData {
  averageTemperature: number; // K
  averageHumidity: number; // 0-1
  precipitation: number; // mm/year
  growingSeasonLength: number; // days
}

export class FertilityCalculator {
  /**
   * Calculate soil moisture from precipitation and humidity
   */
  calculateSoilMoisture(
    precipField: PrecipitationField,
    baseMoisture: number = 0.3,
    drainage: number = 0.7
  ): Map<string, number> {
    const moistureMap = new Map<string, number>();
    
    // Ground-level points (y ≈ 0)
    for (let i = 0; i < precipField.points.length; i++) {
      const point = precipField.points[i];
      
      if (Math.abs(point.y) < 1) { // Ground level
        const key = `${point.x.toFixed(1)}-${point.z.toFixed(1)}`;
        
        // Moisture increases with precipitation and humidity
        const precipContribution = Math.min(1, precipField.precipitationRate[i] / 10); // Normalize to 0-1
        const humidityContribution = precipField.relativeHumidity[i];
        
        // Combined effect
        const moistureIncrease = (precipContribution * 0.6 + humidityContribution * 0.4);
        
        // Drainage reduces moisture retention
        const retainedMoisture = moistureIncrease * drainage;
        
        // Final moisture (clamped to 0-1)
        const totalMoisture = Math.min(1, Math.max(0, baseMoisture + retainedMoisture * (1 - baseMoisture)));
        
        moistureMap.set(key, totalMoisture);
      }
    }
    
    return moistureMap;
  }
  
  /**
   * Calculate fertility based on climate and soil conditions
   */
  calculateFertility(
    soilConditions: SoilConditions,
    climateData: ClimateData,
    precipField: PrecipitationField,
    location: Location
  ): FertilityAssessment {
    // Calculate various fertility factors
    const moistureScore = soilConditions.moisture;
    const temperatureScore = this.calculateTemperatureScore(climateData.averageTemperature);
    const precipitationScore = this.calculatePrecipitationScore(climateData.precipitation);
    const nutrientScore = this.calculateNutrientScore(soilConditions.nutrients);
    const phScore = this.calculatePhScore(soilConditions.ph);
    
    // Weighted overall fertility
    const overallFertility = (
      moistureScore * 0.25 +
      temperatureScore * 0.20 +
      precipitationScore * 0.20 +
      nutrientScore * 0.20 +
      phScore * 0.15
    );
    
    // Crop-specific suitability
    const cropSuitability = {
      grains: this.calculateGrainSuitability(soilConditions, climateData),
      vegetables: this.calculateVegetableSuitability(soilConditions, climateData),
      fruits: this.calculateFruitSuitability(soilConditions, climateData),
      trees: this.calculateTreeSuitability(soilConditions, climateData)
    };
    
    // Generate recommendations
    const recommendations = this.generateRecommendations(
      soilConditions,
      climateData,
      overallFertility
    );
    
    // Identify limitations
    const limitations = this.identifyLimitations(
      soilConditions,
      climateData,
      overallFertility
    );
    
    return {
      overallFertility,
      cropSuitability,
      recommendations,
      limitations
    };
  }
  
  /**
   * Calculate temperature suitability (optimal: 15-25°C)
   */
  private calculateTemperatureScore(temperature: number): number {
    const tempC = temperature - 273.15; // Convert to Celsius
    
    // Optimal temperature range
    const optimalMin = 15;
    const optimalMax = 25;
    
    if (tempC >= optimalMin && tempC <= optimalMax) {
      return 1.0;
    } else if (tempC < optimalMin) {
      // Colder - plants grow slower
      return Math.max(0, 1 - (optimalMin - tempC) / 20);
    } else {
      // Warmer - heat stress
      return Math.max(0, 1 - (tempC - optimalMax) / 15);
    }
  }
  
  /**
   * Calculate precipitation suitability (optimal: 500-1500 mm/year)
   */
  private calculatePrecipitationScore(precipitation: number): number {
    const optimalMin = 500; // mm/year
    const optimalMax = 1500; // mm/year
    
    if (precipitation >= optimalMin && precipitation <= optimalMax) {
      return 1.0;
    } else if (precipitation < optimalMin) {
      // Too dry
      return Math.max(0, precipitation / optimalMin);
    } else {
      // Too wet (but can be managed with drainage)
      return Math.max(0.5, 1 - (precipitation - optimalMax) / (optimalMax * 2));
    }
  }
  
  /**
   * Calculate nutrient score
   */
  private calculateNutrientScore(nutrients: { nitrogen: number; phosphorus: number; potassium: number }): number {
    // Average of NPK, with nitrogen slightly more important
    return (
      nutrients.nitrogen * 0.4 +
      nutrients.phosphorus * 0.3 +
      nutrients.potassium * 0.3
    );
  }
  
  /**
   * Calculate pH score (optimal: 6.0-7.5)
   */
  private calculatePhScore(ph: number): number {
    const optimalMin = 6.0;
    const optimalMax = 7.5;
    const optimalCenter = (optimalMin + optimalMax) / 2;
    
    if (ph >= optimalMin && ph <= optimalMax) {
      return 1.0;
    } else {
      const distance = Math.abs(ph - optimalCenter);
      const maxDistance = Math.max(optimalCenter - 4, 9 - optimalCenter);
      return Math.max(0, 1 - distance / maxDistance);
    }
  }
  
  /**
   * Calculate grain crop suitability
   */
  private calculateGrainSuitability(
    soil: SoilConditions,
    climate: ClimateData
  ): number {
    // Grains prefer moderate moisture, good drainage, neutral pH
    const moistureScore = soil.moisture > 0.4 && soil.moisture < 0.8 ? 1 : 0.7;
    const drainageScore = soil.drainage > 0.6 ? 1 : 0.7;
    const phScore = soil.ph >= 6.0 && soil.ph <= 7.5 ? 1 : 0.8;
    
    return (moistureScore + drainageScore + phScore + this.calculateTemperatureScore(climate.averageTemperature)) / 4;
  }
  
  /**
   * Calculate vegetable crop suitability
   */
  private calculateVegetableSuitability(
    soil: SoilConditions,
    climate: ClimateData
  ): number {
    // Vegetables prefer higher moisture, good nutrients, neutral pH
    const moistureScore = soil.moisture > 0.5 ? 1 : soil.moisture;
    const nutrientScore = this.calculateNutrientScore(soil.nutrients);
    const phScore = soil.ph >= 6.0 && soil.ph <= 7.0 ? 1 : 0.8;
    
    return (moistureScore * 0.3 + nutrientScore * 0.3 + phScore * 0.2 + 
            this.calculateTemperatureScore(climate.averageTemperature) * 0.2);
  }
  
  /**
   * Calculate fruit crop suitability
   */
  private calculateFruitSuitability(
    soil: SoilConditions,
    climate: ClimateData
  ): number {
    // Fruits prefer good drainage, moderate moisture, slightly acidic pH
    const moistureScore = soil.moisture > 0.4 && soil.moisture < 0.7 ? 1 : 0.8;
    const drainageScore = soil.drainage > 0.7 ? 1 : 0.8;
    const phScore = soil.ph >= 5.5 && soil.ph <= 7.0 ? 1 : 0.7;
    
    return (moistureScore * 0.25 + drainageScore * 0.25 + phScore * 0.25 +
            this.calculateTemperatureScore(climate.averageTemperature) * 0.25);
  }
  
  /**
   * Calculate tree crop suitability
   */
  private calculateTreeSuitability(
    soil: SoilConditions,
    climate: ClimateData
  ): number {
    // Trees are more tolerant, prefer good drainage and moderate moisture
    const moistureScore = soil.moisture > 0.3 && soil.moisture < 0.8 ? 1 : 0.7;
    const drainageScore = soil.drainage > 0.5 ? 1 : 0.6;
    
    return (moistureScore * 0.4 + drainageScore * 0.3 +
            this.calculateTemperatureScore(climate.averageTemperature) * 0.3);
  }
  
  /**
   * Generate recommendations
   */
  private generateRecommendations(
    soil: SoilConditions,
    climate: ClimateData,
    fertility: number
  ): string[] {
    const recommendations: string[] = [];
    
    if (soil.moisture < 0.4) {
      recommendations.push('Consider irrigation or water retention structures');
    }
    if (soil.moisture > 0.8) {
      recommendations.push('Improve drainage to prevent waterlogging');
    }
    if (this.calculateNutrientScore(soil.nutrients) < 0.5) {
      recommendations.push('Add organic matter or fertilizer to improve nutrient levels');
    }
    if (soil.ph < 6.0) {
      recommendations.push('Add lime to raise pH');
    }
    if (soil.ph > 7.5) {
      recommendations.push('Add sulfur or organic matter to lower pH');
    }
    if (soil.drainage < 0.5) {
      recommendations.push('Improve drainage with ditches or raised beds');
    }
    if (climate.precipitation < 500) {
      recommendations.push('Consider drought-resistant crops or irrigation systems');
    }
    if (fertility > 0.7) {
      recommendations.push('Excellent conditions - suitable for a wide variety of crops');
    }
    
    return recommendations;
  }
  
  /**
   * Identify limitations
   */
  private identifyLimitations(
    soil: SoilConditions,
    climate: ClimateData,
    fertility: number
  ): string[] {
    const limitations: string[] = [];
    
    if (fertility < 0.4) {
      limitations.push('Low overall fertility - significant improvements needed');
    }
    if (soil.moisture < 0.3) {
      limitations.push('Very dry conditions');
    }
    if (soil.moisture > 0.9) {
      limitations.push('Waterlogged conditions');
    }
    if (climate.precipitation < 300) {
      limitations.push('Arid climate - requires irrigation');
    }
    if (this.calculateTemperatureScore(climate.averageTemperature) < 0.5) {
      limitations.push('Temperature conditions are suboptimal');
    }
    
    return limitations;
  }
  
  /**
   * Estimate enhanced fertility from structures
   */
  calculateEnhancementFactor(
    baseFertility: FertilityAssessment,
    enhancedFertility: FertilityAssessment
  ): {
    fertilityIncrease: number;
    precipitationIncrease: number;
    humidityIncrease: number;
    overallImprovement: string;
  } {
    const fertilityIncrease = enhancedFertility.overallFertility - baseFertility.overallFertility;
    
    // Estimate precipitation and humidity increases (would need actual data)
    const precipitationIncrease = fertilityIncrease * 2; // Rough estimate
    const humidityIncrease = fertilityIncrease * 0.5; // Rough estimate
    
    let overallImprovement = 'None';
    if (fertilityIncrease > 0.2) {
      overallImprovement = 'Significant';
    } else if (fertilityIncrease > 0.1) {
      overallImprovement = 'Moderate';
    } else if (fertilityIncrease > 0.05) {
      overallImprovement = 'Minor';
    }
    
    return {
      fertilityIncrease,
      precipitationIncrease,
      humidityIncrease,
      overallImprovement
    };
  }
}

