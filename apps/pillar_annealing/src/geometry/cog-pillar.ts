/**
 * Generates 3D geometry for cog-shaped pillars inspired by ancient Roman architecture
 */

import * as THREE from 'three';
import { PillarConfig } from '../types';

export class CogPillarGenerator {
  /**
   * Generate a cog-shaped pillar geometry
   */
  static generatePillar(config: PillarConfig): THREE.BufferGeometry {
    const { height, radius, cogTeeth, toothDepth, rotation } = config;
    
    const segments = Math.max(8, cogTeeth * 4); // smoothness
    const vertices: number[] = [];
    const indices: number[] = [];
    const normals: number[] = [];
    const uvs: number[] = [];
    
    // Generate base profile (cog shape)
    const profile: Array<{ x: number; z: number }> = [];
    const teeth = Math.max(4, cogTeeth);
    
    for (let i = 0; i <= segments; i++) {
      const angle = (i / segments) * Math.PI * 2;
      const isTooth = (i % (segments / teeth)) < (segments / teeth / 2);
      
      let r = radius;
      if (isTooth) {
        r = radius * (1 + toothDepth);
      } else {
        r = radius * (1 - toothDepth * 0.3); // slight indent between teeth
      }
      
      profile.push({
        x: r * Math.cos(angle),
        z: r * Math.sin(angle)
      });
    }
    
    // Extrude profile vertically with rotation
    const heightSegments = Math.max(4, Math.floor(height / (radius * 0.5)));
    
    for (let h = 0; h <= heightSegments; h++) {
      const y = (h / heightSegments) * height;
      const twist = (h / heightSegments) * rotation;
      
      for (let i = 0; i < profile.length; i++) {
        const point = profile[i];
        const twistAngle = (i / profile.length) * Math.PI * 2 + twist;
        
        const x = point.x * Math.cos(twistAngle) - point.z * Math.sin(twistAngle);
        const z = point.x * Math.sin(twistAngle) + point.z * Math.cos(twistAngle);
        
        vertices.push(x, y, z);
        
        // Calculate normal (simplified - points outward)
        const normal = new THREE.Vector3(x, 0, z).normalize();
        normals.push(normal.x, normal.y, normal.z);
        
        uvs.push(i / profile.length, h / heightSegments);
        
        // Create faces
        if (h < heightSegments && i < profile.length - 1) {
          const current = h * profile.length + i;
          const next = current + 1;
          const below = current + profile.length;
          const belowNext = below + 1;
          
          // Two triangles per quad
          indices.push(current, below, next);
          indices.push(next, below, belowNext);
        }
      }
    }
    
    // Add top and bottom caps
    this.addCap(vertices, indices, normals, uvs, profile, 0, false);
    this.addCap(vertices, indices, normals, uvs, profile, height, true);
    
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    
    return geometry;
  }
  
  /**
   * Add a cap (top or bottom) to the pillar
   */
  private static addCap(
    vertices: number[],
    indices: number[],
    normals: number[],
    uvs: number[],
    profile: Array<{ x: number; z: number }>,
    y: number,
    isTop: boolean
  ): void {
    const offset = vertices.length / 3;
    const normalY = isTop ? 1 : -1;
    
    // Center vertex
    vertices.push(0, y, 0);
    normals.push(0, normalY, 0);
    uvs.push(0.5, 0.5);
    
    // Profile vertices
    const startIdx = vertices.length / 3;
    profile.forEach((point, i) => {
      vertices.push(point.x, y, point.z);
      normals.push(0, normalY, 0);
      uvs.push(i / profile.length, isTop ? 1 : 0);
    });
    
    // Create faces
    for (let i = 0; i < profile.length - 1; i++) {
      if (isTop) {
        indices.push(offset, startIdx + i + 1, startIdx + i);
      } else {
        indices.push(offset, startIdx + i, startIdx + i + 1);
      }
    }
    // Close the loop
    if (isTop) {
      indices.push(offset, startIdx, startIdx + profile.length - 1);
    } else {
      indices.push(offset, startIdx + profile.length - 1, startIdx);
    }
  }
  
  /**
   * Create a THREE.Mesh from pillar config
   */
  static createMesh(config: PillarConfig): THREE.Mesh {
    const geometry = this.generatePillar(config);
    
    let material: THREE.Material;
    switch (config.material) {
      case 'stone':
        material = new THREE.MeshStandardMaterial({
          color: 0x888888,
          roughness: 0.9,
          metalness: 0.1
        });
        break;
      case 'concrete':
        material = new THREE.MeshStandardMaterial({
          color: 0xcccccc,
          roughness: 0.8,
          metalness: 0.05
        });
        break;
      case 'metal':
        material = new THREE.MeshStandardMaterial({
          color: 0x666666,
          roughness: 0.3,
          metalness: 0.7
        });
        break;
      default:
        material = new THREE.MeshStandardMaterial({ color: 0x888888 });
    }
    
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(config.position.x, config.position.y, config.position.z);
    
    return mesh;
  }
  
  /**
   * Generate a group of pillars with optimized spacing
   */
  static createPillarGroup(configs: PillarConfig[]): THREE.Group {
    const group = new THREE.Group();
    
    configs.forEach(config => {
      const pillar = this.createMesh(config);
      group.add(pillar);
    });
    
    return group;
  }
}

