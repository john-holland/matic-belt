import { EventEmitter } from 'events';
import * as tf from '@tensorflow/tfjs';

export enum TorqueModelType {
    StaticMesh = 'StaticMesh',
    SkinnedMesh = 'SkinnedMesh',
    ParticleEmitter = 'ParticleEmitter',
    Decal = 'Decal',
    Water = 'Water',
    Terrain = 'Terrain',
    Interior = 'Interior',
    Shape = 'Shape',
    Vehicle = 'Vehicle',
    Player = 'Player'
}

export enum CollisionType {
    None = 'None',
    Box = 'Box',
    Sphere = 'Sphere',
    Capsule = 'Capsule',
    Mesh = 'Mesh',
    Convex = 'Convex'
}

export interface TorqueModel {
    type: TorqueModelType;
    properties: ModelProperties;
    animations: Animation[];
    materials: Material[];
    collisions: CollisionData;
    physics: PhysicsProperties;
}

export interface DetailLevel {
    distance: number;
    modelPath: string;
}

export interface ModelProperties {
    name: string;
    path: string;
    position: [number, number, number];
    rotation: [number, number, number];
    scale: [number, number, number];
    lodLevels: number;
    detailLevels: DetailLevel[];
}

interface Animation {
    name: string;
    startFrame: number;
    endFrame: number;
    fps: number;
    loop: boolean;
    priority: number;
    blendTime: number;
}

interface Material {
    name: string;
    diffuseMap: string;
    normalMap?: string;
    specularMap?: string;
    emissiveMap?: string;
    properties: MaterialProperties;
}

interface MaterialProperties {
    diffuseColor: [number, number, number, number];
    specularColor: [number, number, number, number];
    emissiveColor: [number, number, number, number];
    shininess: number;
    reflectivity: number;
    transparency: number;
}

export interface CollisionData {
    type: CollisionType;
    bounds: {
        min: [number, number, number];
        max: [number, number, number];
    };
    convexHulls: {
        vertices: [number, number, number][];
        faces: number[][];
    }[];
}

export interface PhysicsProperties {
    mass: number;
    friction: number;
    restitution: number;
    gravityScale: number;
    linearDamping: number;
    angularDamping: number;
}

export class TorqueAnalyzer extends EventEmitter {
    private models: Map<string, TorqueModel> = new Map();
    private isAnalyzing: boolean = false;

    constructor() {
        super();
    }

    public async analyzeModel(modelData: any): Promise<TorqueModel> {
        const model = this.parseModelData(modelData);
        this.models.set(model.properties.name, model);
        this.emit('modelAnalyzed', model);
        return model;
    }

    private parseModelData(data: any): TorqueModel {
        // Parse model type
        const type = this.determineModelType(data);
        
        // Parse properties based on type
        const properties = this.parseProperties(data);
        const animations = this.parseAnimations(data);
        const materials = this.parseMaterials(data);
        const collisions = this.parseCollisionData(data);
        const physics = this.parsePhysics(data);

        return {
            type,
            properties,
            animations,
            materials,
            collisions,
            physics
        };
    }

    private determineModelType(data: any): TorqueModelType {
        // Determine model type based on data properties
        if (data.skinData) return TorqueModelType.SkinnedMesh;
        if (data.particleData) return TorqueModelType.ParticleEmitter;
        if (data.decalData) return TorqueModelType.Decal;
        if (data.waterData) return TorqueModelType.Water;
        if (data.terrainData) return TorqueModelType.Terrain;
        if (data.interiorData) return TorqueModelType.Interior;
        if (data.shapeData) return TorqueModelType.Shape;
        if (data.vehicleData) return TorqueModelType.Vehicle;
        if (data.playerData) return TorqueModelType.Player;
        return TorqueModelType.StaticMesh;
    }

    private parseProperties(data: any): ModelProperties {
        return {
            name: data.name || 'Unnamed',
            path: data.path || '',
            position: data.position || [0, 0, 0],
            rotation: data.rotation || [0, 0, 0],
            scale: data.scale || [1, 1, 1],
            lodLevels: data.lodLevels || 1,
            detailLevels: this.parseDetailLevels(data)
        };
    }

    private parseDetailLevels(data: any): DetailLevel[] {
        const levels: DetailLevel[] = [];
        if (data.detailLevels) {
            for (const level of data.detailLevels) {
                levels.push({
                    distance: level.distance || 0,
                    modelPath: level.modelPath || ''
                });
            }
        }
        return levels;
    }

    private parseAnimations(data: any): Animation[] {
        const animations: Animation[] = [];
        if (data.animations) {
            for (const anim of data.animations) {
                animations.push({
                    name: anim.name || 'Unnamed',
                    startFrame: anim.startFrame || 0,
                    endFrame: anim.endFrame || 0,
                    fps: anim.fps || 30,
                    loop: anim.loop || false,
                    priority: anim.priority || 0,
                    blendTime: anim.blendTime || 0
                });
            }
        }
        return animations;
    }

    private parseMaterials(data: any): Material[] {
        const materials: Material[] = [];
        if (data.materials) {
            for (const mat of data.materials) {
                materials.push({
                    name: mat.name || 'Unnamed',
                    diffuseMap: mat.diffuseMap || '',
                    normalMap: mat.normalMap,
                    specularMap: mat.specularMap,
                    emissiveMap: mat.emissiveMap,
                    properties: {
                        diffuseColor: mat.diffuseColor || [1, 1, 1, 1],
                        specularColor: mat.specularColor || [0, 0, 0, 1],
                        emissiveColor: mat.emissiveColor || [0, 0, 0, 1],
                        shininess: mat.shininess || 0,
                        reflectivity: mat.reflectivity || 0,
                        transparency: mat.transparency || 0
                    }
                });
            }
        }
        return materials;
    }

    private parseCollisionData(data: any): CollisionData {
        return {
            type: data.type || CollisionType.None,
            bounds: this.parseBounds(data),
            convexHulls: this.parseConvexHulls(data)
        };
    }

    private parseBounds(data: any): {
        min: [number, number, number];
        max: [number, number, number];
    } {
        return {
            min: data.bounds?.min || [0, 0, 0],
            max: data.bounds?.max || [0, 0, 0]
        };
    }

    private parseConvexHulls(data: any): {
        vertices: [number, number, number][];
        faces: number[][];
    }[] {
        const hulls: {
            vertices: [number, number, number][];
            faces: number[][];
        }[] = [];
        if (data.convexHulls) {
            for (const hull of data.convexHulls) {
                hulls.push({
                    vertices: hull.vertices || [],
                    faces: hull.faces || []
                });
            }
        }
        return hulls;
    }

    private parsePhysics(data: any): PhysicsProperties {
        return {
            mass: data.mass || 0,
            friction: data.friction || 0,
            restitution: data.restitution || 0,
            gravityScale: data.gravityScale || 1,
            linearDamping: data.linearDamping || 0,
            angularDamping: data.angularDamping || 0
        };
    }

    public getModel(name: string): TorqueModel | undefined {
        return this.models.get(name);
    }

    public getAllModels(): TorqueModel[] {
        return Array.from(this.models.values());
    }

    public getModelsByType(type: TorqueModelType): TorqueModel[] {
        return this.getAllModels().filter(model => model.type === type);
    }

    public startAnalysis() {
        this.isAnalyzing = true;
    }

    public stopAnalysis() {
        this.isAnalyzing = false;
    }
} 