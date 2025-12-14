/**
 * Example: Designing structures to enhance fertility through microclimate modification
 * 
 * Run with: npm run build && node dist/fertility-example.js
 */

import { PillarDesignFramework } from './index';
import { GiantKiteConfig } from './types';

async function main() {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY || '';
  
  if (!apiKey) {
    console.error('Please set GOOGLE_MAPS_API_KEY environment variable');
    process.exit(1);
  }
  
  const framework = new PillarDesignFramework(apiKey);
  
  // Example: Design giant kites/mountains to create lake effect and enhance fertility
  const location = {
    lat: 35.0, // Example: Middle East / arid region
    lng: 40.0
  };
  
  console.log('=== Fertility Enhancement Design ===\n');
  console.log(`Location: ${location.lat}, ${location.lng}`);
  console.log('Designing structures to enhance humidity and precipitation...\n');
  
  // Option 1: Optimize structure placement automatically
  try {
    console.log('Option 1: Optimizing structure placement...\n');
    
    const optimized = await framework.optimizeForFertility(
      location,
      5, // 5 structures
      'mountain', // mountain structures (could also use 'kite')
      { width: 200, height: 200 }, // 200m x 200m area
      {
        minSpacing: 30,
        minHeight: 50, // meters
        maxHeight: 100 // meters
      }
    );
    
    console.log(`\n=== Optimization Results ===\n`);
    console.log(`Designed ${optimized.structures.length} structures:`);
    optimized.structures.forEach((s, i) => {
      console.log(`  Structure ${i + 1}:`);
      console.log(`    Type: ${s.type}`);
      console.log(`    Position: (${s.position.x.toFixed(1)}, ${s.position.y.toFixed(1)}, ${s.position.z.toFixed(1)})`);
      console.log(`    Height: ${s.height.toFixed(1)}m`);
      console.log(`    Width: ${s.width.toFixed(1)}m`);
      console.log(`    Surface Area: ${s.surfaceArea.toFixed(1)} m²`);
    });
    
    console.log(`\n=== Microclimate Results ===\n`);
    console.log(`Humidity Enhancement:`);
    console.log(`  Average Humidity: ${(optimized.result.humidityEnhancement.averageHumidity * 100).toFixed(1)}%`);
    console.log(`  Enhancement Factor: ${optimized.result.humidityEnhancement.enhancementFactor.toFixed(2)}x`);
    console.log(`  Max Humidity: ${(optimized.result.humidityEnhancement.maxHumidity * 100).toFixed(1)}%`);
    
    console.log(`\nFertility Assessment:`);
    console.log(`  Overall Fertility: ${(optimized.result.fertilityAssessment.overallFertility * 100).toFixed(1)}%`);
    console.log(`  Crop Suitability:`);
    console.log(`    Grains: ${(optimized.result.fertilityAssessment.cropSuitability.grains * 100).toFixed(1)}%`);
    console.log(`    Vegetables: ${(optimized.result.fertilityAssessment.cropSuitability.vegetables * 100).toFixed(1)}%`);
    console.log(`    Fruits: ${(optimized.result.fertilityAssessment.cropSuitability.fruits * 100).toFixed(1)}%`);
    console.log(`    Trees: ${(optimized.result.fertilityAssessment.cropSuitability.trees * 100).toFixed(1)}%`);
    
    console.log(`\nEnhancement Factor:`);
    console.log(`  Fertility Increase: ${(optimized.result.enhancementFactor.fertilityIncrease * 100).toFixed(1)}%`);
    console.log(`  Precipitation Increase: ${optimized.result.enhancementFactor.precipitationIncrease.toFixed(1)}x`);
    console.log(`  Humidity Increase: ${(optimized.result.enhancementFactor.humidityIncrease * 100).toFixed(1)}%`);
    console.log(`  Overall Improvement: ${optimized.result.enhancementFactor.overallImprovement}`);
    
    console.log(`\nRecommendations:`);
    optimized.result.fertilityAssessment.recommendations.forEach((rec, i) => {
      console.log(`  ${i + 1}. ${rec}`);
    });
    
    if (optimized.result.fertilityAssessment.limitations.length > 0) {
      console.log(`\nLimitations:`);
      optimized.result.fertilityAssessment.limitations.forEach((lim, i) => {
        console.log(`  ${i + 1}. ${lim}`);
      });
    }
    
  } catch (error: any) {
    console.error('Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
  
  // Option 2: Design with custom structures
  console.log(`\n\n=== Option 2: Custom Structure Design ===\n`);
  
  const customStructures: GiantKiteConfig[] = [
    {
      position: { x: -50, y: 0, z: -50 },
      height: 80,
      width: 40,
      surfaceArea: 1600,
      type: 'mountain',
      material: 'cloth'
    },
    {
      position: { x: 50, y: 0, z: -50 },
      height: 75,
      width: 35,
      surfaceArea: 1400,
      type: 'mountain',
      material: 'cloth'
    },
    {
      position: { x: 0, y: 0, z: 50 },
      height: 90,
      width: 45,
      surfaceArea: 1800,
      type: 'kite', // Giant kite structure
      material: 'synthetic'
    }
  ];
  
  try {
    const customResult = await framework.designForFertilityEnhancement(
      location,
      customStructures,
      {
        targetArea: { width: 200, height: 200 }
      }
    );
    
    console.log('Custom structure design complete!');
    console.log(`Humidity enhancement: ${customResult.humidityEnhancement.enhancementFactor.toFixed(2)}x`);
    console.log(`Overall fertility: ${(customResult.fertilityAssessment.overallFertility * 100).toFixed(1)}%`);
    
  } catch (error: any) {
    console.error('Error in custom design:', error.message);
  }
}

main().catch(console.error);

