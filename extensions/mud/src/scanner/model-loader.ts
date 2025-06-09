import { Scene, Group, Object3D, Mesh, Material, TextureLoader, MeshStandardMaterial, Color } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader';

interface ModelConfig {
    url: string;
    scale?: number;
    position?: { x: number; y: number; z: number };
    rotation?: { x: number; y: number; z: number };
    materials?: {
        color?: string;
        metalness?: number;
        roughness?: number;
        emissive?: string;
        emissiveIntensity?: number;
    };
}

export class ModelLoader {
    private gltfLoader: GLTFLoader;
    private textureLoader: TextureLoader;
    private loadedModels: Map<string, Group>;

    constructor() {
        this.gltfLoader = new GLTFLoader();
        this.textureLoader = new TextureLoader();
        this.loadedModels = new Map();

        // Initialize DRACO loader for compressed models
        const dracoLoader = new DRACOLoader();
        dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/');
        this.gltfLoader.setDRACOLoader(dracoLoader);
    }

    public async loadModel(config: ModelConfig): Promise<Group> {
        if (this.loadedModels.has(config.url)) {
            return this.loadedModels.get(config.url)!.clone();
        }

        try {
            const gltf = await this.gltfLoader.loadAsync(config.url);
            const model = gltf.scene;

            // Apply transformations
            if (config.scale) {
                model.scale.setScalar(config.scale);
            }
            if (config.position) {
                model.position.set(config.position.x, config.position.y, config.position.z);
            }
            if (config.rotation) {
                model.rotation.set(config.rotation.x, config.rotation.y, config.rotation.z);
            }

            // Apply materials
            if (config.materials) {
                this.applyMaterials(model, config.materials);
            }

            // Store the model
            this.loadedModels.set(config.url, model);
            return model.clone();
        } catch (error) {
            console.error('Error loading model:', error);
            throw error;
        }
    }

    private applyMaterials(object: Object3D, materials: ModelConfig['materials']): void {
        object.traverse((child) => {
            if (child instanceof Mesh) {
                const material = child.material as MeshStandardMaterial;
                
                if (materials.color) {
                    material.color = new Color(materials.color);
                }
                if (materials.metalness !== undefined) {
                    material.metalness = materials.metalness;
                }
                if (materials.roughness !== undefined) {
                    material.roughness = materials.roughness;
                }
                if (materials.emissive) {
                    material.emissive = new Color(materials.emissive);
                }
                if (materials.emissiveIntensity !== undefined) {
                    material.emissiveIntensity = materials.emissiveIntensity;
                }
            }
        });
    }

    public async loadCastleScene(): Promise<Group> {
        return this.loadModel({
            url: 'models/castle.glb',
            scale: 1.0,
            position: { x: 0, y: 0, z: 0 },
            rotation: { x: 0, y: 0, z: 0 },
            materials: {
                color: '#ffd700',
                metalness: 0.8,
                roughness: 0.2,
                emissive: '#ffd700',
                emissiveIntensity: 0.2
            }
        });
    }

    public async loadHotelScene(): Promise<Group> {
        return this.loadModel({
            url: 'models/hotel.glb',
            scale: 1.0,
            position: { x: 0, y: 0, z: 0 },
            rotation: { x: 0, y: 0, z: 0 },
            materials: {
                color: '#ffffff',
                metalness: 0.5,
                roughness: 0.5,
                emissive: '#4285f4',
                emissiveIntensity: 0.3
            }
        });
    }

    public dispose(): void {
        this.loadedModels.forEach(model => {
            model.traverse((child) => {
                if (child instanceof Mesh) {
                    if (Array.isArray(child.material)) {
                        child.material.forEach(material => material.dispose());
                    } else {
                        child.material.dispose();
                    }
                    child.geometry.dispose();
                }
            });
        });
        this.loadedModels.clear();
    }
} 