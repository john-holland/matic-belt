# Code Review & Architecture Documentation
## Pillar Annealing Framework

**Last Updated:** 2024  
**Purpose:** LSTM annealing framework for designing cog-shaped pillars with microclimate and fertility enhancement capabilities

---

## Overview

This framework integrates multiple systems to:
1. Design Roman-inspired cog-shaped pillars using simulated annealing
2. Optimize wind flow patterns around structures
3. Predict flow patterns using LSTM neural networks
4. Design kites (including cubic/box kites) for optimized spaces
5. Calculate lake effect and orographic lift from large structures
6. Assess and enhance agricultural fertility through microclimate modification

---

## Project Structure

```
apps/pillar_annealing/
├── src/
│   ├── index.ts                    # Main framework orchestration
│   ├── server.ts                   # Express REST API server
│   ├── types.ts                    # TypeScript type definitions
│   │
│   ├── geometry/
│   │   └── cog-pillar.ts          # 3D cog-shaped pillar geometry generator
│   │
│   ├── wind/
│   │   └── wind-flow.ts           # Wind flow simulation and analysis
│   │
│   ├── lstm/
│   │   └── flow-predictor.ts      # LSTM neural network for flow prediction
│   │
│   ├── optimization/
│   │   └── annealer.ts            # Simulated annealing optimizer
│   │
│   ├── maps/
│   │   └── google-maps-3d.ts      # Google Maps API integration
│   │
│   ├── kites/
│   │   └── kite-designer.ts       # Kite design system (paper/cloth/silk)
│   │
│   ├── microclimate/
│   │   ├── index.ts               # Microclimate module exports
│   │   ├── lake-effect.ts         # Lake effect precipitation calculator
│   │   ├── orographic-lift.ts     # Orographic lift modeling
│   │   └── fertility-calculator.ts # Soil moisture and fertility assessment
│   │
│   ├── microclimate-designer.ts   # High-level microclimate design orchestration
│   │
│   ├── example.ts                 # Basic usage example
│   ├── fertility-example.ts       # Fertility enhancement example
│   └── cubic-kite-pillars.ts      # Cubic kite pillar generator
│
├── public/
│   └── index.html                 # Web interface
│
├── package.json                   # Dependencies and scripts
├── tsconfig.json                  # TypeScript configuration
└── README.md                      # User documentation
```

---

## Core Components

### 1. Geometry (`geometry/cog-pillar.ts`)

**Purpose:** Generate 3D geometry for cog-shaped pillars inspired by ancient Roman architecture.

**Key Classes:**
- `CogPillarGenerator`
  - `generatePillar(config)` - Creates BufferGeometry for a single pillar
  - `createMesh(config)` - Creates Three.js mesh with material
  - `createPillarGroup(configs)` - Creates a group of pillars

**Key Features:**
- Configurable cog teeth (number, depth)
- Vertical rotation/twist
- Material support (stone, concrete, metal)
- Top and bottom caps
- Uses Three.js BufferGeometry

**Dependencies:** `three`

---

### 2. Wind Flow Analysis (`wind/wind-flow.ts`)

**Purpose:** Simulate wind flow patterns around pillars using simplified CFD principles.

**Key Classes:**
- `WindFlowAnalyzer`
  - `calculateFlowField(pillars, windData)` - Main flow calculation
  - `calculateFlowQuality(flowField, constraints)` - Quality metric

**Key Features:**
- Grid-based flow field calculation
- Pillar wake and deflection modeling
- Pressure estimation (windward/leeward)
- Turbulence injection
- Flow quality metrics (uniformity, shelter effectiveness)

**Physics:**
- Deflection perpendicular to wind direction
- Wake effect reduces velocity behind pillars
- Pressure higher on windward side, lower on leeward

---

### 3. LSTM Flow Predictor (`lstm/flow-predictor.ts`)

**Purpose:** Use LSTM neural networks to learn and predict flow patterns.

**Key Classes:**
- `FlowPredictor`
  - `train(sequences, epochs)` - Train on historical flow data
  - `predict(history)` - Predict next flow state

**Architecture:**
- Input: Sequence of flow field features (8 features × 10 timesteps)
- Layers: 2 LSTM layers (64 → 32 units) with dropout
- Output: Flow vectors + quality metrics (6 values)
- Uses TensorFlow.js

**Features:**
- Feature extraction from flow fields
- Sequence-based learning
- Prediction of flow quality, turbulence, pressure gradients

**Dependencies:** `@tensorflow/tfjs`, `@tensorflow/tfjs-node`

---

### 4. Simulated Annealing (`optimization/annealer.ts`)

**Purpose:** Optimize pillar arrangement to minimize energy (maximize flow quality).

**Key Classes:**
- `PillarAnnealer`
  - `step()` - One annealing iteration
  - `optimize(maxIterations)` - Full optimization run

**Energy Function Components:**
1. Flow quality (inverse) - Weight: 100
2. Spacing penalties - Weight: 50
3. Size constraints - Weight: 30
4. Coverage penalties - Weight: 20

**Neighbor Generation:**
- Random modifications: position, height, rotation, radius
- Validates spacing and boundary constraints
- Temperature decreases with cooling rate (default: 0.95)

**Early Stopping:**
- Converges when temperature < minTemp
- Stops after max stagnant iterations (50)

---

### 5. Google Maps Integration (`maps/google-maps-3d.ts`)

**Purpose:** Fetch terrain data and estimate wind patterns from location.

**Key Classes:**
- `GoogleMaps3D`
  - `getElevation(location)` - Get elevation data
  - `getTerrainData(location)` - Get slope, aspect, roughness
  - `estimateWindData(location, terrain)` - Estimate wind from terrain
  - `findShelteredLocations(center, radius)` - Find optimal locations

**Features:**
- Elevation API integration
- Terrain analysis (slope, aspect, roughness)
- Wind estimation based on elevation and terrain
- Shelter scoring for location optimization

**API Requirements:**
- Google Maps Elevation API key
- Google Maps Static Maps API (optional, for visualization)

**Dependencies:** `axios`

---

### 6. Kite Designer (`kites/kite-designer.ts`)

**Purpose:** Design kites (diamond, delta, box/cubic) optimized for flow fields.

**Key Classes:**
- `KiteDesigner`
  - `designKitesForSpace(flowField, windData, pillars, material, count)`
  - `calculateKitePhysics(kite, windData)` - Lift, drag, stability
  - `createKiteMesh(kite, position)` - Three.js mesh generation

**Kite Types:**
- **Diamond**: Classic kite shape, good for light winds
- **Delta**: Better for higher winds (>7 m/s)
- **Box/Cubic**: Stable in moderate winds, uses depth dimension

**Materials:**
- **Paper**: Lightweight (0.08 kg/m²), low strength, good for light winds
- **Cloth**: Balanced (0.15 kg/m²), versatile
- **Silk**: Premium (0.10 kg/m²), high strength, very flexible

**Physics Calculations:**
- Lift: `L = 0.5 * ρ * v² * A * CL`
- Drag: `D = 0.5 * ρ * v² * A * CD`
- Stability based on material flexibility and shape

**Positioning:**
- Finds optimal positions with moderate velocity (3-8 m/s)
- Avoids proximity to pillars
- Prefers kite-flying height (3-10m)

---

### 7. Microclimate: Lake Effect (`microclimate/lake-effect.ts`)

**Purpose:** Simulate lake effect precipitation from large structures.

**Key Classes:**
- `LakeEffectCalculator`
  - `calculateLakeEffect(structures, upstreamState, windData)` - Main calculation
  - `calculateTotalPrecipitation(precipField, area)` - Total precipitation
  - `calculateHumidityEnhancement(precipField, upstreamHumidity)` - Enhancement metrics

**Physics:**
- **Orographic lift**: Structures force air upward
- **Adiabatic cooling**: Dry lapse rate (~9.8 K/km), moist (~5 K/km)
- **Condensation**: When air reaches dew point, clouds form
- **Precipitation**: Condensed water falls as rain/snow

**Key Concepts:**
- **Structure influence**: Proportional to height, decreases with distance
- **Wake effects**: Reduced velocity behind structures
- **Evaporation**: Structures can add moisture (like lakes)
- **Precipitation rate**: Based on humidity, lifting, wind speed (max ~15 mm/hour)

**Output:**
- `PrecipitationField`: Grid of precipitation rates, cloud cover, humidity

---

### 8. Microclimate: Orographic Lift (`microclimate/orographic-lift.ts`)

**Purpose:** Model orographic lift from mountain structures.

**Key Classes:**
- `OrographicLiftCalculator`
  - `calculateOrographicLift(structures, windData, upstreamState)`
  - `calculatePrecipitationIntensity(effect, upstreamState, height)`

**Physics:**
- Wind component perpendicular to mountain face causes lifting
- Vertical velocity = `windSpeed * sin(slopeAngle)`
- Cooling rate = `liftingRate * lapseRate`
- Cloud base height calculated from dew point

**Mountain Structures:**
- Require profile data (slope, terrain profile)
- Generate lifting effects based on wind direction
- Precipitation intensity increases with structure height

---

### 9. Microclimate: Fertility Calculator (`microclimate/fertility-calculator.ts`)

**Purpose:** Assess agricultural fertility from climate and soil conditions.

**Key Classes:**
- `FertilityCalculator`
  - `calculateSoilMoisture(precipField, baseMoisture, drainage)`
  - `calculateFertility(soilConditions, climateData, precipField, location)`
  - `calculateEnhancementFactor(baseFertility, enhancedFertility)`

**Soil Conditions:**
- Moisture content (0-1)
- Organic matter (0-1)
- Drainage quality (0-1)
- pH level (4-9)
- Nutrients (N, P, K - each 0-1)

**Climate Data:**
- Average temperature (Kelvin)
- Average humidity (0-1)
- Precipitation (mm/year)
- Growing season length (days)

**Fertility Assessment:**
- Overall fertility score (0-1)
- Crop-specific suitability:
  - Grains: Prefer moderate moisture, good drainage, neutral pH
  - Vegetables: Prefer higher moisture, good nutrients
  - Fruits: Prefer good drainage, slightly acidic pH
  - Trees: More tolerant, prefer moderate conditions

**Recommendations:**
- Automatic suggestions based on conditions
- Identifies limitations (dry, waterlogged, etc.)

---

### 10. Microclimate Designer (`microclimate-designer.ts`)

**Purpose:** High-level orchestration for fertility enhancement design.

**Key Classes:**
- `MicroclimateDesigner`
  - `designForFertility(location, structures, options)` - Main design method
  - `optimizeStructurePlacement(location, count, type, area, constraints)` - Automatic optimization

**Workflow:**
1. Get terrain and wind data from Google Maps
2. Convert structures to common format
3. Calculate lake effect / orographic lift
4. Calculate soil moisture from precipitation
5. Assess base vs. enhanced fertility
6. Return comprehensive results

**Structure Types:**
- Can use `GiantKiteConfig` or `PillarConfig`
- Supports 'kite' and 'mountain' types
- Automatically calculates surface area and dimensions

---

### 11. Main Framework (`index.ts`)

**Purpose:** Main orchestration class that ties everything together.

**Key Classes:**
- `PillarDesignFramework`
  - `designPillarsAndKites(location, constraints, options)` - Main design workflow
  - `designForFertilityEnhancement(...)` - Fertility design
  - `optimizeForFertility(...)` - Fertility optimization
  - `findOptimalLocation(...)` - Location finding

**Design Workflow:**
1. Fetch terrain and wind data
2. Generate initial pillar arrangement
3. Run simulated annealing optimization
4. Train LSTM (optional)
5. Design kites for optimized space
6. Return comprehensive results

---

### 12. Server (`server.ts`)

**Purpose:** Express REST API server.

**Endpoints:**
- `POST /api/design` - Design pillars and kites
- `POST /api/find-location` - Find sheltered locations
- `POST /api/fertility` - Design for fertility enhancement
- `POST /api/optimize-fertility` - Optimize for maximum fertility
- `GET /api/health` - Health check
- `GET /` - Web interface

**Configuration:**
- Port: 3002 (default)
- Requires: `GOOGLE_MAPS_API_KEY` environment variable

---

## Example Scripts

### 1. `example.ts`
Basic pillar and kite design example. Shows standard workflow.

### 2. `fertility-example.ts`
Demonstrates fertility enhancement:
- Optimizes structure placement
- Shows humidity/precipitation enhancement
- Displays fertility assessments and recommendations

### 3. `cubic-kite-pillars.ts`
**Specialized for cubic kite support:**
1. Optimizes initial pillar arrangement
2. Designs 5m × 5m × 3m cubic kite
3. Generates 4 supporting pillars at attachment points
4. Final optimization of all pillars together

**Key Feature:** Creates pillars specifically positioned to support cubic kite attachment points.

---

## Type Definitions (`types.ts`)

**Key Interfaces:**
- `Location` - lat/lng coordinates
- `WindData` - Wind speed, direction, turbulence
- `PillarConfig` - Pillar geometry and material
- `FlowField` - Grid of flow vectors and pressure
- `KiteDesign` - Kite shape, material, dimensions, attachment points
- `DesignConstraints` - Spacing, height, area constraints
- `GiantKiteConfig` - Large kite/mountain structure config
- `MicroclimateResult` - Precipitation, humidity, fertility results

---

## Dependencies

**Runtime:**
- `@tensorflow/tfjs` - LSTM neural networks
- `@tensorflow/tfjs-node` - Node.js TensorFlow backend
- `express` - Web server
- `three` - 3D geometry
- `axios` - HTTP requests (Google Maps API)

**Development:**
- `typescript` - TypeScript compiler
- `@types/node`, `@types/express`, `@types/three` - Type definitions

---

## API Key Requirements

**Required:**
- `GOOGLE_MAPS_API_KEY` - For terrain/elevation data and wind estimation

**API Endpoints Used:**
- Google Maps Elevation API
- Google Maps Static Maps API (optional)

**Setup:**
```bash
export GOOGLE_MAPS_API_KEY=your_key_here
```

---

## Key Algorithms

### Simulated Annealing
- **Temperature**: Starts high (1000), cools by factor (0.95)
- **Acceptance**: `P = exp(-ΔE / T)` (Metropolis criterion)
- **Neighbor**: Random modifications within constraints
- **Energy**: Weighted sum of flow quality, spacing, coverage

### Flow Simulation
- **Grid-based**: 50×50×50 resolution (configurable)
- **Influence radius**: 5× pillar radius
- **Deflection**: Perpendicular to wind, proportional to influence
- **Wake**: Velocity reduction behind pillars (up to 70%)

### LSTM Training
- **Sequence length**: 10 timesteps
- **Features**: 8 per timestep (velocity stats, pressure, wind)
- **Architecture**: 2 LSTM layers (64→32) + 2 dense layers
- **Loss**: Mean squared error
- **Optimizer**: Adam (learning rate: 0.001)

---

## Design Patterns

1. **Modular Architecture**: Each component is self-contained
2. **Interface-based**: Types ensure compatibility
3. **Async/Await**: All I/O operations are async
4. **Error Handling**: Try-catch with meaningful error messages
5. **Configuration-driven**: Constraints and options passed as objects

---

## Future Enhancements (Not Yet Implemented)

1. Real-time 3D visualization (Three.js in browser)
2. Integration with actual weather APIs (not just terrain-based estimation)
3. Advanced CFD simulations (more accurate flow modeling)
4. Model persistence (save/load trained LSTM models)
5. CAD export (STL, OBJ formats)
6. VR/AR visualization
7. Seasonal variation modeling
8. Crop-specific optimization algorithms

---

## Testing Strategy

**Manual Testing:**
- Run example scripts with real API key
- Test API endpoints with curl/Postman
- Verify geometry generation in 3D viewer

**Unit Testing (Recommended):**
- Test individual calculator classes
- Mock Google Maps API responses
- Test annealing convergence
- Verify flow field calculations

---

## Performance Considerations

**Optimization Targets:**
- Flow field calculation: O(n²) where n = grid resolution
- Annealing: Typically 100-1000 iterations
- LSTM training: Depends on dataset size (can be slow)
- Google Maps API: Rate-limited, cache terrain data

**Bottlenecks:**
- High-resolution flow fields (50³ = 125,000 points)
- LSTM training on large datasets
- Google Maps API calls (network latency)

**Optimization Ideas:**
- Parallelize flow field calculation
- Reduce grid resolution for initial optimization
- Cache terrain data locally
- Use Web Workers for LSTM training (browser)

---

## Known Limitations

1. **Simplified Physics**: Flow simulation uses simplified CFD, not full Navier-Stokes
2. **Terrain Estimation**: Wind data estimated from terrain, not actual weather data
3. **LSTM Training**: Requires historical data, default predictions are basic
4. **API Dependency**: Requires Google Maps API key (costs money)
5. **Single-threaded**: No parallel processing yet

---

## Code Quality Notes

**Strengths:**
- Well-structured, modular design
- TypeScript provides type safety
- Clear separation of concerns
- Comprehensive type definitions

**Areas for Improvement:**
- Add unit tests
- Add JSDoc comments for all public methods
- Extract magic numbers to constants
- Add error handling for edge cases
- Consider using dependency injection for testability

---

## Getting Started (Quick Reference)

```bash
# Install
cd apps/pillar_annealing
npm install

# Set API key
export GOOGLE_MAPS_API_KEY=your_key

# Build
npm run build

# Run examples
npm run example              # Basic pillar design
npm run fertility-example    # Fertility enhancement
npm run cubic-kite           # Cubic kite pillars

# Start server
npm run serve                # Runs on http://localhost:3002
```

---

## Questions for Future Development

1. **API Funding**: Need sustainable way to fund Google Maps API usage
2. **Real Weather Data**: Should we integrate OpenWeatherMap or similar?
3. **Model Training**: Where will LSTM training data come from?
4. **Visualization**: WebGL or server-side rendering?
5. **Deployment**: Host this as a service or keep local?

---

**End of Code Review Document**

