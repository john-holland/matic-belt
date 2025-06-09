import { ScannerManager } from './scanner-manager';
import { InterpolationEnhancer } from './interpolation-enhancer';
import { Vector3 } from 'three';

// Mock ImageData for testing
class MockImageData {
  width: number;
  height: number;
  data: Uint8ClampedArray;

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.data = new Uint8ClampedArray(width * height * 4);
  }
}

async function testScanner() {
  console.log('Initializing scanner...');
  const scanner = new ScannerManager({
    lightInterpolationEnabled: true,
    objectDetectionEnabled: true,
    gpsUpdateInterval: 1000
  });

  // Initialize interpolation enhancer
  const enhancer = new InterpolationEnhancer(
    scanner['lightInterpolator'],
    scanner['objectDetector']
  );

  // Test light interpolation
  console.log('\nTesting light interpolation...');
  scanner.addQuad(
    new Vector3(0, 2, 0),
    new Vector3(0, -1, 0),
    new Vector3(2, 2, 0.1),
    0.8
  );

  scanner.addQuad(
    new Vector3(3, 2, 0),
    new Vector3(0, -1, 0),
    new Vector3(2, 2, 0.1),
    0.6
  );

  // Test object detection
  console.log('\nTesting object detection...');
  const testImage = new MockImageData(640, 480);
  const objects = await scanner.getState().detectedObjects;
  console.log('Detected objects:', objects);

  // Test GPS updates
  console.log('\nTesting GPS updates...');
  await scanner.updateGps(new Vector3(0, 0, 0), 50);
  console.log('Current position:', scanner.getState().currentPosition);
  console.log('Current speed:', scanner.getState().currentSpeed);

  // Test interpolation enhancement
  console.log('\nTesting interpolation enhancement...');
  const enhancedResult = await enhancer.enhanceInterpolation(
    new Vector3(0, 0, 0),
    new Vector3(0, 0, 1)
  );
  console.log('Enhanced result:', enhancedResult);

  // Test state changes
  scanner.on('stateChanged', (state) => {
    console.log('\nState changed:');
    console.log('Light intensity:', state.lightIntensity);
    console.log('Detected objects:', state.detectedObjects.length);
    console.log('Last GPS update:', new Date(state.lastGpsUpdate).toISOString());
  });

  enhancer.on('enhancementComplete', (result) => {
    console.log('\nEnhancement complete:');
    console.log('Description:', result.description);
    console.log('Confidence:', result.confidence);
    if (result.enhancedImage) {
      console.log('Enhanced image generated');
    }
  });

  // Clean up
  console.log('\nCleaning up...');
  await scanner.stop();
}

// Run the test
testScanner().catch(console.error); 