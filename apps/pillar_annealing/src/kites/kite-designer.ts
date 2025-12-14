/**
 * Kite design system for paper/cloth kites within pillar-arranged spaces
 */

import * as THREE from 'three';
import { KiteDesign, FlowField, PillarConfig } from '../types';
import { WindData } from '../types';

export interface KiteMaterial {
  name: 'paper' | 'cloth' | 'silk';
  density: number; // kg/m²
  strength: number; // tensile strength (N/m²)
  flexibility: number; // 0-1, how much it bends
  airPermeability: number; // 0-1, how much air passes through
}

export interface KitePhysics {
  lift: number; // Newtons
  drag: number; // Newtons
  stability: number; // 0-1
  optimalWindSpeed: number; // m/s
}

export class KiteDesigner {
  private materials: Map<string, KiteMaterial> = new Map();
  
  constructor() {
    this.initializeMaterials();
  }
  
  /**
   * Initialize material properties
   */
  private initializeMaterials(): void {
    this.materials.set('paper', {
      name: 'paper',
      density: 0.08,
      strength: 50000,
      flexibility: 0.3,
      airPermeability: 0.1
    });
    
    this.materials.set('cloth', {
      name: 'cloth',
      density: 0.15,
      strength: 150000,
      flexibility: 0.6,
      airPermeability: 0.4
    });
    
    this.materials.set('silk', {
      name: 'silk',
      density: 0.10,
      strength: 200000,
      flexibility: 0.8,
      airPermeability: 0.2
    });
  }
  
  /**
   * Design kites for a given space and flow field
   */
  designKitesForSpace(
    flowField: FlowField,
    windData: WindData,
    pillars: PillarConfig[],
    material: 'paper' | 'cloth' | 'silk' = 'cloth',
    count: number = 5
  ): KiteDesign[] {
    const materialProps = this.materials.get(material)!;
    const kites: KiteDesign[] = [];
    
    // Find optimal positions for kites (where flow is smooth and moderate)
    const optimalPositions = this.findOptimalKitePositions(flowField, windData, pillars, count);
    
    for (let i = 0; i < optimalPositions.length && i < count; i++) {
      const position = optimalPositions[i];
      const localFlow = this.getLocalFlow(position, flowField);
      
      // Determine kite shape based on wind conditions
      const shape = this.selectKiteShape(localFlow, materialProps);
      
      // Calculate optimal dimensions
      const dimensions = this.calculateKiteDimensions(
        localFlow,
        materialProps,
        windData
      );
      
      // Calculate attachment points (for lines)
      const attachmentPoints = this.calculateAttachmentPoints(shape, dimensions);
      
      // Calculate orientation (face into wind)
      const orientation = this.calculateOrientation(localFlow);
      
      const kite: KiteDesign = {
        shape,
        material,
        dimensions,
        attachmentPoints,
        orientation,
        color: this.selectColor(material, i)
      };
      
      kites.push(kite);
    }
    
    return kites;
  }
  
  /**
   * Find optimal positions for kites based on flow field
   */
  private findOptimalKitePositions(
    flowField: FlowField,
    windData: WindData,
    pillars: PillarConfig[],
    count: number
  ): Array<{ x: number; y: number; z: number }> {
    // Find points with:
    // - Moderate velocity (not too fast, not too slow)
    // - Low turbulence
    // - Good spacing from pillars
    // - Good spacing from each other
    
    const candidates: Array<{ point: { x: number; y: number; z: number }; score: number }> = [];
    
    // Sample flow field points
    const sampleRate = Math.max(1, Math.floor(flowField.points.length / 100));
    
    for (let i = 0; i < flowField.points.length; i += sampleRate) {
      const point = flowField.points[i];
      const vector = flowField.vectors[i];
      
      // Calculate velocity
      const velocity = Math.sqrt(vector.x ** 2 + vector.y ** 2 + vector.z ** 2);
      
      // Check if too close to any pillar
      let tooCloseToPillar = false;
      for (const pillar of pillars) {
        const dist = Math.sqrt(
          (point.x - pillar.position.x) ** 2 +
          (point.z - pillar.position.z) ** 2
        );
        if (dist < pillar.radius * 2) {
          tooCloseToPillar = true;
          break;
        }
      }
      
      if (tooCloseToPillar) continue;
      
      // Score: prefer moderate velocities (3-8 m/s), smooth flow
      const optimalVelocity = 5.5; // m/s
      const velocityScore = 1 - Math.abs(velocity - optimalVelocity) / optimalVelocity;
      
      // Prefer points at kite-flying height (3-10 meters)
      const optimalHeight = 6; // meters
      const heightScore = 1 - Math.abs(point.y - optimalHeight) / optimalHeight;
      const heightScoreClamped = Math.max(0, heightScore);
      
      // Overall score
      const score = velocityScore * 0.6 + heightScoreClamped * 0.4;
      
      candidates.push({ point, score });
    }
    
    // Sort by score
    candidates.sort((a, b) => b.score - a.score);
    
    // Select positions with good spacing
    const selected: Array<{ x: number; y: number; z: number }> = [];
    const minSpacing = 5; // meters
    
    for (const candidate of candidates) {
      if (selected.length >= count) break;
      
      let tooClose = false;
      for (const selectedPoint of selected) {
        const dist = Math.sqrt(
          (candidate.point.x - selectedPoint.x) ** 2 +
          (candidate.point.z - selectedPoint.z) ** 2
        );
        if (dist < minSpacing) {
          tooClose = true;
          break;
        }
      }
      
      if (!tooClose) {
        selected.push(candidate.point);
      }
    }
    
    return selected;
  }
  
  /**
   * Get local flow vector at a point
   */
  private getLocalFlow(
    point: { x: number; y: number; z: number },
    flowField: FlowField
  ): { x: number; y: number; z: number } {
    // Find closest flow field point
    let minDist = Infinity;
    let closestVector = { x: 0, y: 0, z: 0 };
    
    for (let i = 0; i < flowField.points.length; i++) {
      const dist = Math.sqrt(
        (flowField.points[i].x - point.x) ** 2 +
        (flowField.points[i].y - point.y) ** 2 +
        (flowField.points[i].z - point.z) ** 2
      );
      
      if (dist < minDist) {
        minDist = dist;
        closestVector = flowField.vectors[i];
      }
    }
    
    return closestVector;
  }
  
  /**
   * Select appropriate kite shape based on conditions
   */
  private selectKiteShape(
    flowVector: { x: number; y: number; z: number },
    material: KiteMaterial
  ): 'diamond' | 'delta' | 'box' | 'custom' {
    const velocity = Math.sqrt(flowVector.x ** 2 + flowVector.y ** 2 + flowVector.z ** 2);
    
    // Delta kites are better in higher winds
    if (velocity > 7) {
      return 'delta';
    }
    
    // Box kites for stable, moderate winds
    if (velocity > 4 && material.name !== 'paper') {
      return 'box';
    }
    
    // Diamond for light winds or paper
    return 'diamond';
  }
  
  /**
   * Calculate optimal kite dimensions
   */
  private calculateKiteDimensions(
    flowVector: { x: number; y: number; z: number },
    material: KiteMaterial,
    windData: WindData
  ): { width: number; height: number; depth?: number } {
    const velocity = Math.sqrt(flowVector.x ** 2 + flowVector.y ** 2 + flowVector.z ** 2);
    
    // Base size on wind speed and material strength
    const baseArea = 1.5; // m²
    
    // Adjust for wind speed (larger in lighter winds)
    const areaMultiplier = Math.max(0.5, Math.min(2, 6 / velocity));
    const area = baseArea * areaMultiplier;
    
    // Aspect ratio depends on kite type (simplified)
    const aspectRatio = 1.2; // width/height
    
    const height = Math.sqrt(area / aspectRatio);
    const width = height * aspectRatio;
    
    // Depth only for box kites
    return { width, height, depth: undefined };
  }
  
  /**
   * Calculate attachment points for kite strings
   */
  private calculateAttachmentPoints(
    shape: 'diamond' | 'delta' | 'box' | 'custom',
    dimensions: { width: number; height: number; depth?: number }
  ): Array<{ x: number; y: number; z: number }> {
    const points: Array<{ x: number; y: number; z: number }> = [];
    
    switch (shape) {
      case 'diamond':
        // Center point for diamond
        points.push({ x: 0, y: 0, z: 0 });
        break;
      case 'delta':
        // Three points: center and two wing tips
        points.push({ x: 0, y: 0, z: 0 });
        points.push({ x: -dimensions.width / 2, y: 0, z: 0 });
        points.push({ x: dimensions.width / 2, y: 0, z: 0 });
        break;
      case 'box':
        // Four corners
        const depth = dimensions.depth || 0.3;
        points.push({ x: -dimensions.width / 2, y: -dimensions.height / 2, z: -depth / 2 });
        points.push({ x: dimensions.width / 2, y: -dimensions.height / 2, z: -depth / 2 });
        points.push({ x: dimensions.width / 2, y: dimensions.height / 2, z: -depth / 2 });
        points.push({ x: -dimensions.width / 2, y: dimensions.height / 2, z: -depth / 2 });
        break;
    }
    
    return points;
  }
  
  /**
   * Calculate orientation to face into wind
   */
  private calculateOrientation(
    flowVector: { x: number; y: number; z: number }
  ): { x: number; y: number; z: number } {
    // Orient kite to face into wind
    const angle = Math.atan2(flowVector.x, flowVector.z);
    
    return {
      x: 0,
      y: angle * (180 / Math.PI), // Convert to degrees
      z: 0
    };
  }
  
  /**
   * Calculate kite physics (lift, drag, stability)
   */
  calculateKitePhysics(
    kite: KiteDesign,
    windData: WindData
  ): KitePhysics {
    const material = this.materials.get(kite.material)!;
    const area = kite.dimensions.width * kite.dimensions.height;
    const velocity = windData.averageSpeed;
    
    // Simplified lift calculation (L = 0.5 * rho * v² * A * CL)
    const rho = 1.225; // air density kg/m³
    const CL = 0.8; // lift coefficient (simplified)
    const lift = 0.5 * rho * velocity ** 2 * area * CL;
    
    // Drag (D = 0.5 * rho * v² * A * CD)
    const CD = 0.3; // drag coefficient
    const drag = 0.5 * rho * velocity ** 2 * area * CD;
    
    // Stability (based on material flexibility and kite shape)
    let stability = 0.7;
    stability += material.flexibility * 0.2;
    if (kite.shape === 'box') stability += 0.1;
    
    // Optimal wind speed (based on material and size)
    const optimalWindSpeed = Math.sqrt(material.strength / (0.5 * rho * area * CD)) * 0.5;
    
    return {
      lift,
      drag,
      stability: Math.min(1, stability),
      optimalWindSpeed
    };
  }
  
  /**
   * Create 3D mesh for kite visualization
   */
  createKiteMesh(kite: KiteDesign, position: { x: number; y: number; z: number }): THREE.Mesh {
    const geometry = this.createKiteGeometry(kite);
    
    const material = new THREE.MeshStandardMaterial({
      color: kite.color || 0xffffff,
      side: THREE.DoubleSide,
      roughness: kite.material === 'cloth' ? 0.8 : 0.6,
      metalness: 0
    });
    
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(position.x, position.y, position.z);
    mesh.rotation.y = (kite.orientation.y * Math.PI) / 180;
    
    return mesh;
  }
  
  /**
   * Create geometry for kite shape
   */
  private createKiteGeometry(kite: KiteDesign): THREE.BufferGeometry {
    const { width, height, depth } = kite.dimensions;
    
    switch (kite.shape) {
      case 'diamond':
        return this.createDiamondGeometry(width, height);
      case 'delta':
        return this.createDeltaGeometry(width, height);
      case 'box':
        return this.createBoxGeometry(width, height, depth || 0.3);
      default:
        return this.createDiamondGeometry(width, height);
    }
  }
  
  private createDiamondGeometry(width: number, height: number): THREE.BufferGeometry {
    const shape = new THREE.Shape();
    shape.moveTo(0, height / 2);
    shape.lineTo(width / 2, 0);
    shape.lineTo(0, -height / 2);
    shape.lineTo(-width / 2, 0);
    shape.lineTo(0, height / 2);
    
    const geometry = new THREE.ShapeGeometry(shape);
    return geometry;
  }
  
  private createDeltaGeometry(width: number, height: number): THREE.BufferGeometry {
    const shape = new THREE.Shape();
    shape.moveTo(0, height / 2);
    shape.lineTo(-width / 2, -height / 2);
    shape.lineTo(width / 2, -height / 2);
    shape.lineTo(0, height / 2);
    
    const geometry = new THREE.ShapeGeometry(shape);
    return geometry;
  }
  
  private createBoxGeometry(width: number, height: number, depth: number): THREE.BufferGeometry {
    return new THREE.BoxGeometry(width, height, depth);
  }
  
  /**
   * Select color based on material and index
   */
  private selectColor(material: 'paper' | 'cloth' | 'silk', index: number): string {
    const colors = {
      paper: ['#ffffff', '#fff9e6', '#ffe6e6', '#e6f2ff', '#e6ffe6'],
      cloth: ['#4a90e2', '#50c878', '#ff6b6b', '#ffd93d', '#9b59b6'],
      silk: ['#ff69b4', '#00ced1', '#ffd700', '#ff6347', '#9370db']
    };
    
    const materialColors = colors[material];
    return materialColors[index % materialColors.length];
  }
}

