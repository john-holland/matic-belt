/**
 * Example usage of the Pillar Annealing Framework
 * 
 * Run with: npm run build && node dist/example.js
 */

import { PillarDesignFramework } from './index';

async function main() {
  // You'll need to set your Google Maps API key
  const apiKey = process.env.GOOGLE_MAPS_API_KEY || '';
  
  if (!apiKey) {
    console.error('Please set GOOGLE_MAPS_API_KEY environment variable');
    process.exit(1);
  }
  
  const framework = new PillarDesignFramework(apiKey);
  
  // Example: Design pillars for a location near Rome (Colosseum area)
  const location = {
    lat: 41.9028,
    lng: 12.4964
  };
  
  const constraints = {
    minPillarSpacing: 3,      // meters
    maxPillarSpacing: 15,     // meters
    minPillarHeight: 2,       // meters
    maxPillarHeight: 10,      // meters
    buildArea: {
      width: 30,              // meters
      height: 30              // meters
    },
    windShelter: false,       // Don't require wind shelter
    windDirection: 0          // Wind from north
  };
  
  const options = {
    numPillars: 8,
    kiteMaterial: 'cloth' as const,
    numKites: 5,
    maxIterations: 500
  };
  
  console.log('Starting pillar design...');
  console.log(`Location: ${location.lat}, ${location.lng}`);
  
  try {
    const result = await framework.designPillarsAndKites(
      location,
      constraints,
      options
    );
    
    console.log('\n=== Design Results ===\n');
    console.log(`Location: ${result.location.lat}, ${result.location.lng}`);
    console.log(`Elevation: ${result.terrain.elevation.toFixed(1)}m`);
    console.log(`Slope: ${result.terrain.slope.toFixed(2)}`);
    console.log(`Aspect: ${result.terrain.aspect.toFixed(1)}°`);
    console.log(`\nWind Data:`);
    console.log(`  Speed: ${result.windData.averageSpeed.toFixed(2)} m/s`);
    console.log(`  Direction: ${result.windData.averageDirection.toFixed(1)}°`);
    console.log(`  Turbulence: ${result.windData.turbulence.toFixed(2)}`);
    
    console.log(`\nOptimized ${result.pillars.length} pillars:`);
    result.pillars.forEach((pillar, i) => {
      console.log(`  Pillar ${i + 1}:`);
      console.log(`    Position: (${pillar.position.x.toFixed(2)}, ${pillar.position.y.toFixed(2)}, ${pillar.position.z.toFixed(2)})`);
      console.log(`    Height: ${pillar.height.toFixed(2)}m`);
      console.log(`    Radius: ${pillar.radius.toFixed(2)}m`);
      console.log(`    Cog Teeth: ${pillar.cogTeeth}`);
      console.log(`    Rotation: ${(pillar.rotation * 180 / Math.PI).toFixed(1)}°`);
    });
    
    console.log(`\nDesigned ${result.kites.length} kites:`);
    result.kites.forEach((kite, i) => {
      console.log(`  Kite ${i + 1}:`);
      console.log(`    Shape: ${kite.shape}`);
      console.log(`    Material: ${kite.material}`);
      console.log(`    Dimensions: ${kite.dimensions.width.toFixed(2)}m x ${kite.dimensions.height.toFixed(2)}m`);
      console.log(`    Color: ${kite.color}`);
    });
    
    console.log(`\nAnnealing completed in ${result.annealingHistory.length} iterations`);
    if (result.annealingHistory.length > 0) {
      const last = result.annealingHistory[result.annealingHistory.length - 1];
      console.log(`Final energy: ${last.energy.toFixed(2)}`);
    }
    
  } catch (error: any) {
    console.error('Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run example
main().catch(console.error);

