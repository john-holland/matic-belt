/**
 * Wind flow analysis and simulation around cog-shaped pillars
 */

import { WindData, FlowField, PillarConfig } from '../types';
import * as THREE from 'three';

export class WindFlowAnalyzer {
  private resolution: number = 50; // grid resolution
  private domainSize: { width: number; height: number; depth: number };
  
  constructor(domainSize: { width: number; height: number; depth: number }) {
    this.domainSize = domainSize;
  }
  
  /**
   * Calculate flow field around pillars given wind conditions
   */
  calculateFlowField(
    pillars: PillarConfig[],
    windData: WindData,
    obstacles?: THREE.Box3[]
  ): FlowField {
    const { width, height, depth } = this.domainSize;
    const stepX = width / this.resolution;
    const stepY = height / this.resolution;
    const stepZ = depth / this.resolution;
    
    const points: Array<{ x: number; y: number; z: number }> = [];
    const vectors: Array<{ x: number; y: number; z: number }> = [];
    const pressure: number[] = [];
    
    // Convert wind direction to vector (assuming wind comes FROM this direction)
    const windDirRad = (windData.averageDirection * Math.PI) / 180;
    const windVector = new THREE.Vector3(
      Math.sin(windDirRad) * windData.averageSpeed,
      0,
      -Math.cos(windDirRad) * windData.averageSpeed
    );
    
    // Generate grid points
    for (let i = 0; i < this.resolution; i++) {
      for (let j = 0; j < this.resolution; j++) {
        for (let k = 0; k < this.resolution; k++) {
          const x = -width / 2 + i * stepX;
          const y = j * stepY;
          const z = -depth / 2 + k * stepZ;
          
          const point = new THREE.Vector3(x, y, z);
          points.push({ x, y, z });
          
          // Calculate flow vector at this point
          const flowVector = this.calculateFlowAtPoint(
            point,
            pillars,
            windVector,
            windData.turbulence
          );
          
          vectors.push({ x: flowVector.x, y: flowVector.y, z: flowVector.z });
          
          // Estimate pressure (higher near obstacles, lower in wake)
          const p = this.estimatePressure(point, pillars, windData);
          pressure.push(p);
        }
      }
    }
    
    return { points, vectors, pressure };
  }
  
  /**
   * Calculate flow vector at a specific point considering pillar interference
   */
  private calculateFlowAtPoint(
    point: THREE.Vector3,
    pillars: PillarConfig[],
    windVector: THREE.Vector3,
    turbulence: number
  ): THREE.Vector3 {
    let flow = windVector.clone();
    
    // Sum contributions from all pillars
    for (const pillar of pillars) {
      const pillarPos = new THREE.Vector3(
        pillar.position.x,
        pillar.position.y,
        pillar.position.z
      );
      
      const distance = point.distanceTo(pillarPos);
      const maxInfluence = pillar.radius * 5; // influence radius
      
      if (distance < maxInfluence && distance > 0.01) {
        // Direction from pillar to point
        const direction = point.clone().sub(pillarPos).normalize();
        
        // Calculate deflection (pillar creates wake and deflection)
        const influence = 1 - (distance / maxInfluence);
        const heightInfluence = this.getHeightInfluence(point.y, pillar);
        
        // Deflection perpendicular to wind direction
        const deflectionStrength = influence * heightInfluence * windVector.length() * 0.5;
        
        // Create deflection vector (perpendicular to wind)
        const windPerp = new THREE.Vector3(-windVector.z, 0, windVector.x).normalize();
        const deflection = windPerp.multiplyScalar(deflectionStrength * Math.sign(direction.dot(windPerp)));
        
        // Wake effect (reduced velocity behind pillar)
        const windDir = windVector.clone().normalize();
        const toPoint = direction.clone();
        const dotProduct = windDir.dot(toPoint);
        
        if (dotProduct < -0.5) { // Behind the pillar
          const wakeStrength = Math.abs(dotProduct) * influence;
          flow.multiplyScalar(1 - wakeStrength * 0.7);
        }
        
        flow.add(deflection);
      }
    }
    
    // Add turbulence
    if (turbulence > 0) {
      const noise = new THREE.Vector3(
        (Math.random() - 0.5) * turbulence * windVector.length(),
        (Math.random() - 0.5) * turbulence * windVector.length() * 0.3,
        (Math.random() - 0.5) * turbulence * windVector.length()
      );
      flow.add(noise);
    }
    
    return flow;
  }
  
  /**
   * Get height-based influence factor
   */
  private getHeightInfluence(pointY: number, pillar: PillarConfig): number {
    if (pointY < pillar.position.y || pointY > pillar.position.y + pillar.height) {
      return 0.3; // Reduced influence outside pillar height
    }
    return 1.0;
  }
  
  /**
   * Estimate pressure at a point
   */
  private estimatePressure(
    point: THREE.Vector3,
    pillars: PillarConfig[],
    windData: WindData
  ): number {
    let pressure = 1.0; // ambient pressure
    
    for (const pillar of pillars) {
      const pillarPos = new THREE.Vector3(
        pillar.position.x,
        pillar.position.y,
        pillar.position.z
      );
      
      const distance = point.distanceTo(pillarPos);
      const maxInfluence = pillar.radius * 4;
      
      if (distance < maxInfluence) {
        const influence = 1 - (distance / maxInfluence);
        
        // Higher pressure on windward side, lower on leeward
        const windDirRad = (windData.averageDirection * Math.PI) / 180;
        const windDir = new THREE.Vector3(
          Math.sin(windDirRad),
          0,
          -Math.cos(windDirRad)
        );
        const toPoint = point.clone().sub(pillarPos).normalize();
        const dotProduct = windDir.dot(toPoint);
        
        if (dotProduct > 0) {
          // Windward side - higher pressure
          pressure += influence * 0.5;
        } else {
          // Leeward side - lower pressure (wake)
          pressure -= influence * 0.3;
        }
      }
    }
    
    return Math.max(0.1, Math.min(2.0, pressure));
  }
  
  /**
   * Calculate flow quality metric (higher is better)
   * Considers: velocity uniformity, pressure gradients, shelter effectiveness
   */
  calculateFlowQuality(flowField: FlowField, constraints?: { sheltered?: boolean; targetDirection?: number }): number {
    let quality = 0;
    let count = 0;
    
    // Measure velocity uniformity (lower variation is better)
    const velocities = flowField.vectors.map(v => Math.sqrt(v.x ** 2 + v.y ** 2 + v.z ** 2));
    const avgVelocity = velocities.reduce((a, b) => a + b, 0) / velocities.length;
    const variance = velocities.reduce((sum, v) => sum + (v - avgVelocity) ** 2, 0) / velocities.length;
    const uniformity = 1 / (1 + variance);
    quality += uniformity * 0.4;
    count += 0.4;
    
    // Measure pressure gradient smoothness
    const pressureVariance = this.calculateVariance(flowField.pressure);
    const pressureSmoothness = 1 / (1 + pressureVariance);
    quality += pressureSmoothness * 0.3;
    count += 0.3;
    
    // If shelter is required, measure effectiveness
    if (constraints?.sheltered && constraints?.targetDirection !== undefined) {
      const shelterQuality = this.calculateShelterQuality(flowField, constraints.targetDirection);
      quality += shelterQuality * 0.3;
      count += 0.3;
    }
    
    return count > 0 ? quality / count : 0;
  }
  
  /**
   * Calculate variance of an array
   */
  private calculateVariance(values: number[]): number {
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    return values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length;
  }
  
  /**
   * Calculate how well the area is sheltered from wind
   */
  private calculateShelterQuality(flowField: FlowField, windDirection: number): number {
    const windDirRad = (windDirection * Math.PI) / 180;
    const windDir = new THREE.Vector3(Math.sin(windDirRad), 0, -Math.cos(windDirRad));
    
    // Average velocity in sheltered area should be lower
    const avgVelocity = flowField.vectors.reduce((sum, v) => {
      const vel = new THREE.Vector3(v.x, v.y, v.z);
      return sum + vel.length();
    }, 0) / flowField.vectors.length;
    
    // Normalize (assuming max wind speed of 20 m/s)
    const normalizedVelocity = Math.max(0, 1 - avgVelocity / 20);
    
    return normalizedVelocity;
  }
}

