/**
 * Example: Finding optimal wind farm locations
 * 
 * Run with: npm run build && node dist/wind-farm-example.js
 */

import { PillarDesignFramework } from './index';

async function main() {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY || '';
  
  if (!apiKey) {
    console.error('Please set GOOGLE_MAPS_API_KEY environment variable');
    process.exit(1);
  }
  
  const framework = new PillarDesignFramework(apiKey);
  
  // Example locations (choose one)
  const locations = [
    { name: 'North Dakota, USA', lat: 47.5515, lng: -101.0020 }, // Great Plains - good wind
    { name: 'Texas Panhandle, USA', lat: 35.5370, lng: -101.3746 }, // High wind area
    { name: 'North Sea Coast', lat: 55.3781, lng: -1.7261 }, // Offshore potential
  ];
  
  const location = locations[0]; // Use first location
  
  console.log(`=== Wind Farm Site Search ===\n`);
  console.log(`Location: ${location.name}`);
  console.log(`Coordinates: ${location.lat}, ${location.lng}\n`);
  
  // Test both farm types
  for (const farmType of ['kite', 'propeller'] as const) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`Searching for ${farmType.toUpperCase()} wind farm sites...`);
    console.log('='.repeat(60) + '\n');
    
    try {
      const result = await framework.findOptimalWindFarmSites({
        centerLocation: { lat: location.lat, lng: location.lng },
        searchRadius: 20000, // 20km search radius
        gridResolution: 15, // 15x15 grid (225 locations)
        minWindSpeed: 5, // m/s minimum
        minAreaSize: 50000, // 5 hectares minimum
        farmType,
        targetPowerOutput: 50 // MW target
      });
      
      console.log(`\n=== Search Results ===\n`);
      console.log(`Total sites evaluated: ${result.analysis.totalSitesEvaluated}`);
      console.log(`Average wind speed: ${result.analysis.averageWindSpeed.toFixed(2)} m/s`);
      
      console.log(`\n=== Top 5 Sites ===\n`);
      result.topSites.slice(0, 5).forEach((site, index) => {
        console.log(`${index + 1}. Site at (${site.location.lat.toFixed(4)}, ${site.location.lng.toFixed(4)})`);
        console.log(`   Score: ${site.score.toFixed(3)}`);
        console.log(`   Wind Speed: ${site.metrics.averageWindSpeed.toFixed(2)} m/s`);
        console.log(`   Wind Consistency: ${(site.metrics.windConsistency * 100).toFixed(1)}%`);
        console.log(`   Altitude: ${site.metrics.altitude.toFixed(0)}m`);
        console.log(`   Terrain Suitability: ${(site.metrics.terrainSuitability * 100).toFixed(1)}%`);
        console.log(`   Accessibility: ${(site.metrics.accessibility * 100).toFixed(1)}%`);
        console.log(`   Area: ${(site.metrics.areaSize / 10000).toFixed(1)} hectares`);
        if (site.metrics.estimatedPowerOutput) {
          console.log(`   Estimated Power: ${site.metrics.estimatedPowerOutput.toFixed(1)} MW`);
        }
        console.log(`   Recommended: ${site.recommendedPillarCount} pillars, ${site.recommendedSpacing}m spacing`);
        console.log('');
      });
      
      console.log(`\n=== Recommendations ===\n`);
      result.analysis.recommendations.forEach((rec, i) => {
        console.log(`${i + 1}. ${rec}`);
      });
      
      // Design pillars for the best site
      if (result.topSites.length > 0) {
        console.log(`\n=== Designing Pillars for Best Site ===\n`);
        
        const bestSite = result.topSites[0];
        const pillarDesign = await framework.designPillarsForWindFarm(
          bestSite,
          farmType
        );
        
        console.log(`Designed ${pillarDesign.pillars.length} pillars`);
        console.log(`\nOptimization Notes:`);
        pillarDesign.optimizationNotes.forEach((note, i) => {
          console.log(`  ${i + 1}. ${note}`);
        });
        
        console.log(`\nPillar Details (first 5):`);
        pillarDesign.pillars.slice(0, 5).forEach((pillar, i) => {
          console.log(`  Pillar ${i + 1}:`);
          console.log(`    Position: (${pillar.position.x.toFixed(1)}, ${pillar.position.y.toFixed(1)}, ${pillar.position.z.toFixed(1)})`);
          console.log(`    Height: ${pillar.height.toFixed(1)}m`);
          console.log(`    Radius: ${pillar.radius.toFixed(1)}m`);
        });
      }
      
    } catch (error: any) {
      console.error(`Error searching for ${farmType} wind farms:`, error.message);
      console.error(error.stack);
    }
  }
}

main().catch(console.error);

