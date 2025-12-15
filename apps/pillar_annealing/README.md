# 🏛️ Pillar Annealing Framework

An LSTM annealing framework for designing cog-shaped pillars inspired by ancient Roman architecture, with wind flow optimization and kite design capabilities.

## Features

- **Cog-Shaped Pillar Generation**: Creates 3D geometry for Roman-inspired cog-shaped pillars
- **Simulated Annealing Optimization**: Optimizes pillar arrangement for optimal wind flow
- **LSTM Flow Prediction**: Uses LSTM neural networks to predict and learn flow patterns
- **Google Maps 3D Integration**: Select locations and get terrain/wind data
- **Wind Flow Analysis**: Simulates wind flow around pillars using computational fluid dynamics principles
- **Kite Design System**: Designs paper/cloth/silk kites optimized for the pillar-arranged space
- **🌧️ Lake Effect Calculator**: Simulates how giant structures create precipitation patterns (like lake effect snow)
- **⛰️ Orographic Lift Modeling**: Models how mountains/kites force air upward, causing cooling and precipitation
- **🌱 Fertility Enhancement**: Calculates how structures enhance humidity, soil moisture, and agricultural viability
- **Microclimate Design**: Designs structures to create more humid and fertile land in arid regions
- **⚡ Wind Farm Optimizer**: Finds optimal locations for kite-based and propeller-based wind farms
- **📍 Site Search**: Grid-based search for optimal wind farm sites with comprehensive scoring

## Architecture

### Core Components

1. **Geometry** (`src/geometry/cog-pillar.ts`)
   - Generates 3D cog-shaped pillar geometry using Three.js
   - Configurable teeth, rotation, materials

2. **Wind Flow** (`src/wind/wind-flow.ts`)
   - Simulates wind flow around pillars
   - Calculates flow fields, pressure, and shelter quality

3. **LSTM Predictor** (`src/lstm/flow-predictor.ts`)
   - TensorFlow.js LSTM model for predicting flow patterns
   - Learns from historical flow data

4. **Simulated Annealing** (`src/optimization/annealer.ts`)
   - Optimizes pillar arrangement using simulated annealing
   - Minimizes energy function based on flow quality and constraints

5. **Google Maps Integration** (`src/maps/google-maps-3d.ts`)
   - Fetches elevation and terrain data
   - Estimates wind patterns from terrain
   - Finds sheltered locations

6. **Kite Designer** (`src/kites/kite-designer.ts`)
   - Designs kites (paper/cloth/silk) for optimized spaces
   - Calculates physics (lift, drag, stability)
   - Positions kites in optimal flow regions

7. **Lake Effect Calculator** (`src/microclimate/lake-effect.ts`)
   - Simulates lake effect precipitation from large structures
   - Models atmospheric moisture pickup and condensation
   - Calculates precipitation fields and humidity enhancement

8. **Orographic Lift Calculator** (`src/microclimate/orographic-lift.ts`)
   - Models how mountains/kites force air upward
   - Calculates cooling rates and condensation
   - Estimates precipitation intensity from orographic effects

9. **Fertility Calculator** (`src/microclimate/fertility-calculator.ts`)
   - Calculates soil moisture from precipitation
   - Assesses agricultural fertility based on climate and soil
   - Provides crop suitability scores and recommendations

10. **Microclimate Designer** (`src/microclimate-designer.ts`)
    - Designs structures to enhance fertility
    - Optimizes placement for maximum humidity/precipitation
    - Integrates all microclimate components

11. **Wind Farm Optimizer** (`src/wind-farm/optimizer.ts`)
    - Searches for optimal wind farm locations
    - Supports kite-based and propeller-based wind farms
    - Calculates site scores based on wind, terrain, accessibility
    - Estimates power output and recommends pillar configurations
    - Designs pillar arrangements for selected sites

12. **Main Framework** (`src/index.ts`)
    - Orchestrates the design workflow
    - Ties all components together
    - Provides fertility enhancement and wind farm APIs

13. **Web Server & UI** (`src/server.ts`, `public/index.html`)
    - Express server with REST API
    - Web interface for interactive design

## Installation

```bash
cd apps/pillar_annealing
npm install
npm run build
```

## Configuration

Set your Google Maps API key:

```bash
export GOOGLE_MAPS_API_KEY=your_api_key_here
```

Or create a `.env` file:
```
GOOGLE_MAPS_API_KEY=your_api_key_here
```

## Usage

### Start the Server

```bash
npm run serve
```

Visit `http://localhost:3002` for the web interface.

### API Usage

#### Design Pillars and Kites

```bash
POST /api/design
Content-Type: application/json

{
  "location": {
    "lat": 41.9028,
    "lng": 12.4964
  },
  "constraints": {
    "minPillarSpacing": 3,
    "maxPillarSpacing": 15,
    "minPillarHeight": 2,
    "maxPillarHeight": 10,
    "buildArea": {
      "width": 30,
      "height": 30
    },
    "windShelter": false,
    "windDirection": 0
  },
  "options": {
    "numPillars": 8,
    "kiteMaterial": "cloth",
    "numKites": 5,
    "maxIterations": 500
  }
}
```

#### Find Sheltered Locations

```bash
POST /api/find-location
Content-Type: application/json

{
  "centerLocation": {
    "lat": 41.9028,
    "lng": 12.4964
  },
  "searchRadius": 5000
}
```

#### Design for Fertility Enhancement

```bash
POST /api/fertility
Content-Type: application/json

{
  "location": {
    "lat": 35.0,
    "lng": 40.0
  },
  "structures": [
    {
      "position": { "x": 0, "y": 0, "z": 0 },
      "height": 80,
      "width": 40,
      "surfaceArea": 1600,
      "type": "mountain",
      "material": "cloth"
    }
  ],
  "options": {
    "targetArea": { "width": 200, "height": 200 }
  }
}
```

#### Optimize for Maximum Fertility

```bash
POST /api/optimize-fertility
Content-Type: application/json

{
  "location": {
    "lat": 35.0,
    "lng": 40.0
  },
  "structureCount": 5,
  "structureType": "mountain",
  "targetArea": { "width": 200, "height": 200 },
  "constraints": {
    "minSpacing": 30,
    "minHeight": 50,
    "maxHeight": 100
  }
}
```

#### Search for Wind Farm Sites

```bash
POST /api/wind-farm/search
Content-Type: application/json

{
  "centerLocation": {
    "lat": 47.5515,
    "lng": -101.0020
  },
  "searchRadius": 20000,
  "gridResolution": 20,
  "minWindSpeed": 5,
  "minAreaSize": 50000,
  "farmType": "kite",
  "targetPowerOutput": 50
}
```

#### Design Pillars for Wind Farm Site

```bash
POST /api/wind-farm/design
Content-Type: application/json

{
  "site": {
    "location": { "lat": 47.5515, "lng": -101.0020 },
    "score": 0.85,
    "metrics": { ... },
    "recommendedPillarCount": 10,
    "recommendedSpacing": 150
  },
  "farmType": "kite",
  "constraints": {
    "minPillarHeight": 5,
    "maxPillarHeight": 15
  }
}
```

### Programmatic Usage

#### Standard Pillar Design

```typescript
import { PillarDesignFramework } from './src/index';

const framework = new PillarDesignFramework(process.env.GOOGLE_MAPS_API_KEY!);

const result = await framework.designPillarsAndKites(
  { lat: 41.9028, lng: 12.4964 },
  {
    minPillarSpacing: 3,
    maxPillarSpacing: 15,
    minPillarHeight: 2,
    maxPillarHeight: 10,
    buildArea: { width: 30, height: 30 },
    windShelter: false,
    windDirection: 0
  },
  {
    numPillars: 8,
    kiteMaterial: 'cloth',
    numKites: 5
  }
);

console.log(`Optimized ${result.pillars.length} pillars`);
console.log(`Designed ${result.kites.length} kites`);
```

#### Fertility Enhancement Design

```typescript
// Design structures to create humid, fertile land
const fertilityResult = await framework.optimizeForFertility(
  { lat: 35.0, lng: 40.0 }, // Arid region
  5, // 5 mountain structures
  'mountain',
  { width: 200, height: 200 }, // 200m x 200m area
  {
    minSpacing: 30,
    minHeight: 50,
    maxHeight: 100
  }
);

console.log(`Fertility improvement: ${fertilityResult.result.enhancementFactor.overallImprovement}`);
console.log(`Humidity enhancement: ${fertilityResult.result.humidityEnhancement.enhancementFactor.toFixed(2)}x`);
console.log(`Overall fertility: ${(fertilityResult.result.fertilityAssessment.overallFertility * 100).toFixed(1)}%`);
```

#### Wind Farm Site Search

```typescript
// Search for optimal kite-based wind farm locations
const kiteResult = await framework.findOptimalWindFarmSites({
  centerLocation: { lat: 47.5515, lng: -101.0020 }, // North Dakota
  searchRadius: 20000, // 20km radius
  gridResolution: 20, // 20x20 grid = 400 locations
  minWindSpeed: 5, // m/s
  minAreaSize: 50000, // 5 hectares
  farmType: 'kite',
  targetPowerOutput: 50 // MW
});

console.log(`Found ${kiteResult.topSites.length} optimal sites`);
console.log(`Best site: ${kiteResult.analysis.bestSite.location.lat}, ${kiteResult.analysis.bestSite.location.lng}`);
console.log(`Estimated power: ${kiteResult.analysis.bestSite.metrics.estimatedPowerOutput} MW`);

// Design pillars for the best site
const pillarDesign = await framework.designPillarsForWindFarm(
  kiteResult.analysis.bestSite,
  'kite'
);

console.log(`Designed ${pillarDesign.pillars.length} supporting pillars`);
```

## Design Process

1. **Location Selection**: Choose a location on Google Maps
2. **Terrain Analysis**: Fetch elevation, slope, aspect, and roughness
3. **Wind Estimation**: Estimate wind patterns from terrain data
4. **Pillar Generation**: Create initial cog-shaped pillar arrangement
5. **Annealing Optimization**: Optimize pillar positions using simulated annealing
6. **Flow Analysis**: Calculate wind flow field around optimized pillars
7. **LSTM Training** (optional): Train LSTM on flow patterns for future predictions
8. **Kite Design**: Design kites optimized for the flow field

## Design Constraints

- **Pillar Spacing**: Minimum and maximum distances between pillars
- **Pillar Height**: Range of allowed heights
- **Build Area**: Width and height of the construction area
- **Wind Shelter**: Whether to optimize for wind shelter
- **Wind Direction**: Target wind direction for shelter

## Kite Materials

- **Paper**: Lightweight, low strength, good for light winds
- **Cloth**: Balanced strength and flexibility, versatile
- **Silk**: High strength, very flexible, premium material

## Dependencies

- **@tensorflow/tfjs**: LSTM neural network
- **three**: 3D geometry generation
- **express**: Web server
- **axios**: HTTP requests for Google Maps API

## Microclimate & Fertility Features

### Lake Effect Simulation
Large structures (giant kites, mountains, pillars) can create "lake effect" precipitation patterns:
- Air picks up moisture as it flows over structures
- Structures force air upward (orographic lift)
- Air cools as it rises, causing condensation
- Precipitation falls downwind, creating more humid conditions

### How It Works
1. **Upstream Conditions**: Air flows in with base humidity and temperature
2. **Structure Interaction**: Large structures intercept and lift air
3. **Condensation**: Lifted air cools, reaching dew point and forming clouds
4. **Precipitation**: Water vapor condenses and falls as rain/snow
5. **Enhanced Humidity**: Downwind areas receive increased moisture
6. **Soil Moisture**: Increased precipitation improves soil moisture
7. **Fertility**: Better moisture + nutrients = more fertile land

### Use Cases
- **Arid Region Enhancement**: Create oases in deserts using giant structures
- **Agricultural Planning**: Optimize structure placement for crop viability
- **Water Management**: Enhance precipitation in water-scarce regions
- **Microclimate Creation**: Design local climates for specific crops

## Future Enhancements

- Real-time 3D visualization with Three.js (including moisture/precipitation fields)
- Integration with weather APIs for actual wind and humidity data
- Advanced CFD simulations for more accurate flow modeling
- Machine learning model persistence and transfer learning
- Export to CAD formats for construction planning
- VR/AR visualization of microclimate effects
- Seasonal variation modeling
- Crop-specific optimization algorithms

## License

See main LICENSE file in repository root.

