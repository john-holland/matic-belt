/**
 * Generate pillars to support a cubic kite structure
 * 
 * Run with: npm run build && node dist/cubic-kite-pillars.js
 */

import { PillarDesignFramework } from './index';
import { PillarConfig, KiteDesign } from './types';

async function main() {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY || '';
  
  if (!apiKey) {
    console.error('Please set GOOGLE_MAPS_API_KEY environment variable');
    process.exit(1);
  }
  
  const framework = new PillarDesignFramework(apiKey);
  
  // Design a cubic kite first to get its attachment points
  const location = {
    lat: 41.9028, // Rome area
    lng: 12.4964
  };
  
  console.log('=== Designing Pillars for Cubic Kite Support ===\n');
  console.log(`Location: ${location.lat}, ${location.lng}\n`);
  
  // Step 1: Design initial pillar arrangement for wind flow
  const constraints = {
    minPillarSpacing: 5,
    maxPillarSpacing: 20,
    minPillarHeight: 3,
    maxPillarHeight: 15,
    buildArea: { width: 40, height: 40 },
    windShelter: false,
    windDirection: 0
  };
  
  console.log('Step 1: Optimizing pillar arrangement for wind flow...');
  const pillarResult = await framework.designPillarsAndKites(
    location,
    constraints,
    {
      numPillars: 6, // Start with 6 pillars
      maxIterations: 300,
      kiteMaterial: 'cloth',
      numKites: 0 // We'll add the cubic kite separately
    }
  );
  
  console.log(`✓ Optimized ${pillarResult.pillars.length} pillars\n`);
  
  // Step 2: Design a cubic (box) kite
  console.log('Step 2: Designing cubic kite...');
  
  // Get flow field for kite positioning
  const flowField = pillarResult.flowField;
  const windData = pillarResult.windData;
  
  // Create a large cubic kite (box kite)
  const cubicKite: KiteDesign = {
    shape: 'box',
    material: 'cloth',
    dimensions: {
      width: 5,   // meters
      height: 5,  // meters
      depth: 3    // meters - makes it a cube
    },
    // Attachment points for a cubic kite (4 corners at base)
    attachmentPoints: [
      { x: -2.5, y: 0, z: -1.5 },   // Front-left
      { x: 2.5, y: 0, z: -1.5 },    // Front-right
      { x: 2.5, y: 0, z: 1.5 },     // Back-right
      { x: -2.5, y: 0, z: 1.5 }     // Back-left
    ],
    orientation: { x: 0, y: 0, z: 0 },
    color: '#4a90e2'
  };
  
  // Calculate optimal position for kite (center of optimized area)
  const centerX = pillarResult.pillars.reduce((sum, p) => sum + p.position.x, 0) / pillarResult.pillars.length;
  const centerZ = pillarResult.pillars.reduce((sum, p) => sum + p.position.z, 0) / pillarResult.pillars.length;
  
  // Offset kite attachment points to center position
  const kiteAttachmentPoints = cubicKite.attachmentPoints.map(ap => ({
    x: ap.x + centerX,
    y: ap.y,
    z: ap.z + centerZ
  }));
  
  console.log(`✓ Cubic kite designed: ${cubicKite.dimensions.width}m × ${cubicKite.dimensions.height}m × ${cubicKite.dimensions.depth}m`);
  console.log(`  Position: (${centerX.toFixed(2)}, 0, ${centerZ.toFixed(2)})\n`);
  
  // Step 3: Generate supporting pillars at kite attachment points
  console.log('Step 3: Generating supporting pillars at kite attachment points...');
  
  const supportingPillars: PillarConfig[] = [];
  
  kiteAttachmentPoints.forEach((point, index) => {
    // Find nearest existing pillar
    let nearestPillar: PillarConfig | null = null;
    let minDistance = Infinity;
    
    for (const pillar of pillarResult.pillars) {
      const distance = Math.sqrt(
        (pillar.position.x - point.x) ** 2 +
        (pillar.position.z - point.z) ** 2
      );
      if (distance < minDistance) {
        minDistance = distance;
        nearestPillar = pillar;
      }
    }
    
    // Create supporting pillar at or near attachment point
    // Height should be tall enough to support kite lines
    const supportHeight = cubicKite.dimensions.height * 1.5; // 1.5x kite height for support
    
    supportingPillars.push({
      position: {
        x: point.x,
        y: 0,
        z: point.z
      },
      height: supportHeight,
      radius: 1.0,
      cogTeeth: 12, // More teeth for better structural support
      toothDepth: 0.15,
      rotation: (index / kiteAttachmentPoints.length) * Math.PI * 2, // Vary rotation
      material: 'stone'
    });
    
    console.log(`  Pillar ${index + 1} at (${point.x.toFixed(2)}, 0, ${point.z.toFixed(2)}), height: ${supportHeight.toFixed(2)}m`);
  });
  
  // Step 4: Combine existing pillars with supporting pillars
  console.log('\nStep 4: Combining all pillars...');
  const allPillars = [...pillarResult.pillars, ...supportingPillars];
  
  console.log(`✓ Total pillars: ${allPillars.length}`);
  console.log(`  - Wind flow pillars: ${pillarResult.pillars.length}`);
  console.log(`  - Supporting pillars: ${supportingPillars.length}\n`);
  
  // Step 5: Final optimization considering all pillars
  console.log('Step 5: Final optimization with all pillars...');
  
  const finalResult = await framework.designPillarsAndKites(
    location,
    {
      ...constraints,
      minPillarSpacing: 2, // Allow closer spacing for supporting pillars
      maxPillarHeight: 20  // Allow taller supporting pillars
    },
    {
      initialPillars: allPillars,
      maxIterations: 200,
      kiteMaterial: 'cloth',
      numKites: 0
    }
  );
  
  console.log(`✓ Final optimization complete\n`);
  
  // Summary
  console.log('=== FINAL DESIGN SUMMARY ===\n');
  console.log(`Cubic Kite Specifications:`);
  console.log(`  Dimensions: ${cubicKite.dimensions.width}m × ${cubicKite.dimensions.height}m × ${cubicKite.dimensions.depth}m`);
  console.log(`  Material: ${cubicKite.material}`);
  console.log(`  Color: ${cubicKite.color}`);
  console.log(`  Position: (${centerX.toFixed(2)}, 0, ${centerZ.toFixed(2)})`);
  console.log(`  Attachment Points: ${kiteAttachmentPoints.length}`);
  
  console.log(`\nSupporting Pillars:`);
  finalResult.pillars.slice(pillarResult.pillars.length).forEach((pillar, i) => {
    console.log(`  Support Pillar ${i + 1}:`);
    console.log(`    Position: (${pillar.position.x.toFixed(2)}, ${pillar.position.y.toFixed(2)}, ${pillar.position.z.toFixed(2)})`);
    console.log(`    Height: ${pillar.height.toFixed(2)}m`);
    console.log(`    Radius: ${pillar.radius.toFixed(2)}m`);
    console.log(`    Cog Teeth: ${pillar.cogTeeth}`);
    console.log(`    Material: ${pillar.material}`);
  });
  
  console.log(`\nWind Flow Pillars: ${pillarResult.pillars.length}`);
  console.log(`Total Pillars: ${finalResult.pillars.length}`);
  console.log(`\nWind Conditions:`);
  console.log(`  Speed: ${finalResult.windData.averageSpeed.toFixed(2)} m/s`);
  console.log(`  Direction: ${finalResult.windData.averageDirection.toFixed(1)}°`);
  
  console.log('\n✓ Design complete! Pillars are ready to support the cubic kite.\n');
}

main().catch(console.error);

