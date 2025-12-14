/**
 * Express server for pillar annealing framework web interface
 */

import express from 'express';
import path from 'path';
import { PillarDesignFramework } from './index';
import { Location, DesignConstraints } from './types';

const app = express();
const PORT = process.env.PORT || 3002;

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// Initialize framework (requires Google Maps API key)
const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY || '';
if (!GOOGLE_MAPS_API_KEY) {
  console.warn('Warning: GOOGLE_MAPS_API_KEY not set. Some features may not work.');
}

const framework = new PillarDesignFramework(GOOGLE_MAPS_API_KEY);

// API Routes

/**
 * POST /api/design
 * Design pillars and kites for a location
 */
app.post('/api/design', async (req, res) => {
  try {
    const { location, constraints, options } = req.body;
    
    if (!location || !constraints) {
      return res.status(400).json({ error: 'Missing required parameters: location, constraints' });
    }
    
    // Validate location
    if (typeof location.lat !== 'number' || typeof location.lng !== 'number') {
      return res.status(400).json({ error: 'Invalid location format' });
    }
    
    // Default constraints
    const designConstraints: DesignConstraints = {
      minPillarSpacing: constraints.minPillarSpacing || 3,
      maxPillarSpacing: constraints.maxPillarSpacing || 15,
      minPillarHeight: constraints.minPillarHeight || 2,
      maxPillarHeight: constraints.maxPillarHeight || 10,
      buildArea: constraints.buildArea || { width: 30, height: 30 },
      windShelter: constraints.windShelter || false,
      windDirection: constraints.windDirection || 0,
      ...constraints
    };
    
    const result = await framework.designPillarsAndKites(
      location as Location,
      designConstraints,
      options || {}
    );
    
    res.json(result);
  } catch (error: any) {
    console.error('Error in /api/design:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

/**
 * POST /api/find-location
 * Find optimal (sheltered) locations
 */
app.post('/api/find-location', async (req, res) => {
  try {
    const { centerLocation, searchRadius } = req.body;
    
    if (!centerLocation) {
      return res.status(400).json({ error: 'Missing centerLocation' });
    }
    
    const locations = await framework.findOptimalLocation(
      centerLocation as Location,
      searchRadius || 5000
    );
    
    res.json({ locations });
  } catch (error: any) {
    console.error('Error in /api/find-location:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

/**
 * POST /api/fertility
 * Design structures for fertility enhancement
 */
app.post('/api/fertility', async (req, res) => {
  try {
    const { location, structures, options } = req.body;
    
    if (!location) {
      return res.status(400).json({ error: 'Missing location' });
    }
    
    const result = await framework.designForFertilityEnhancement(
      location,
      structures || [],
      options || {}
    );
    
    res.json(result);
  } catch (error: any) {
    console.error('Error in /api/fertility:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

/**
 * POST /api/optimize-fertility
 * Optimize structure placement for maximum fertility
 */
app.post('/api/optimize-fertility', async (req, res) => {
  try {
    const { location, structureCount, structureType, targetArea, constraints } = req.body;
    
    if (!location || !structureCount || !structureType || !targetArea) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }
    
    const result = await framework.optimizeForFertility(
      location,
      structureCount,
      structureType,
      targetArea,
      constraints || {}
    );
    
    res.json(result);
  } catch (error: any) {
    console.error('Error in /api/optimize-fertility:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

/**
 * GET /api/health
 * Health check
 */
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Serve main page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Start server
app.listen(PORT, () => {
  console.log(`Pillar Annealing Framework server running on http://localhost:${PORT}`);
  console.log(`Google Maps API Key: ${GOOGLE_MAPS_API_KEY ? 'Set' : 'Not set'}`);
});

