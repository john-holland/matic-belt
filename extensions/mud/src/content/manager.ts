import { Group, Texture, TextureLoader, Font, FontLoader, AudioLoader, Audio } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader';
import { EventEmitter } from 'events';
import * as fs from 'fs';
import * as path from 'path';

interface ContentConfig {
    basePath: string;
    shaders: {
        vertex: string;
        fragment: string;
    };
    models: {
        path: string;
        draco: boolean;
    };
    textures: {
        path: string;
        formats: string[];
    };
    sounds: {
        path: string;
        formats: string[];
    };
    fonts: {
        path: string;
        format: string;
    };
}

interface SceneGraph {
    name: string;
    nodes: SceneNode[];
    materials: MaterialConfig[];
    animations: AnimationConfig[];
}

interface SceneNode {
    id: string;
    type: 'model' | 'light' | 'camera' | 'empty';
    asset?: string;
    transform: {
        position: [number, number, number];
        rotation: [number, number, number];
        scale: [number, number, number];
    };
    children?: SceneNode[];
    material?: string;
    properties?: Record<string, any>;
}

interface MaterialConfig {
    id: string;
    type: 'standard' | 'phong' | 'basic' | 'shader';
    shader?: {
        vertex: string;
        fragment: string;
        uniforms?: Record<string, any>;
    };
    properties: {
        color?: string;
        metalness?: number;
        roughness?: number;
        emissive?: string;
        emissiveIntensity?: number;
        map?: string;
        normalMap?: string;
        displacementMap?: string;
        aoMap?: string;
        roughnessMap?: string;
        metalnessMap?: string;
    };
}

interface AnimationConfig {
    id: string;
    target: string;
    type: 'position' | 'rotation' | 'scale' | 'material';
    keyframes: {
        time: number;
        value: any;
        easing?: string;
    }[];
}

export class ContentManager extends EventEmitter {
    private config: ContentConfig;
    private textureLoader: TextureLoader;
    private modelLoader: GLTFLoader;
    private fontLoader: FontLoader;
    private audioLoader: AudioLoader;
    private loadedAssets: Map<string, any>;
    private sceneGraphs: Map<string, SceneGraph>;

    constructor(config: ContentConfig) {
        super();
        this.config = config;
        this.loadedAssets = new Map();
        this.sceneGraphs = new Map();
        this.initializeLoaders();
    }

    private initializeLoaders(): void {
        this.textureLoader = new TextureLoader();
        this.modelLoader = new GLTFLoader();
        this.fontLoader = new FontLoader();
        this.audioLoader = new AudioLoader();

        if (this.config.models.draco) {
            const dracoLoader = new DRACOLoader();
            dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/');
            this.modelLoader.setDRACOLoader(dracoLoader);
        }
    }

    public async loadShader(name: string): Promise<{ vertex: string; fragment: string }> {
        const cacheKey = `shader:${name}`;
        if (this.loadedAssets.has(cacheKey)) {
            return this.loadedAssets.get(cacheKey);
        }

        const vertexPath = path.join(this.config.basePath, this.config.shaders.vertex, `${name}.vert`);
        const fragmentPath = path.join(this.config.basePath, this.config.shaders.fragment, `${name}.frag`);

        const [vertex, fragment] = await Promise.all([
            fs.promises.readFile(vertexPath, 'utf-8'),
            fs.promises.readFile(fragmentPath, 'utf-8')
        ]);

        const shader = { vertex, fragment };
        this.loadedAssets.set(cacheKey, shader);
        return shader;
    }

    public async loadModel(name: string): Promise<Group> {
        const cacheKey = `model:${name}`;
        if (this.loadedAssets.has(cacheKey)) {
            return this.loadedAssets.get(cacheKey).clone();
        }

        const modelPath = path.join(this.config.basePath, this.config.models.path, `${name}.glb`);
        const gltf = await this.modelLoader.loadAsync(modelPath);
        const model = gltf.scene;

        this.loadedAssets.set(cacheKey, model);
        return model.clone();
    }

    public async loadTexture(name: string): Promise<Texture> {
        const cacheKey = `texture:${name}`;
        if (this.loadedAssets.has(cacheKey)) {
            return this.loadedAssets.get(cacheKey);
        }

        const texturePath = path.join(this.config.basePath, this.config.textures.path, name);
        const texture = await this.textureLoader.loadAsync(texturePath);
        
        this.loadedAssets.set(cacheKey, texture);
        return texture;
    }

    public async loadSound(name: string): Promise<Audio> {
        const cacheKey = `sound:${name}`;
        if (this.loadedAssets.has(cacheKey)) {
            return this.loadedAssets.get(cacheKey);
        }

        const soundPath = path.join(this.config.basePath, this.config.sounds.path, name);
        const buffer = await this.audioLoader.loadAsync(soundPath);
        const audio = new Audio(buffer);
        
        this.loadedAssets.set(cacheKey, audio);
        return audio;
    }

    public async loadFont(name: string): Promise<Font> {
        const cacheKey = `font:${name}`;
        if (this.loadedAssets.has(cacheKey)) {
            return this.loadedAssets.get(cacheKey);
        }

        const fontPath = path.join(this.config.basePath, this.config.fonts.path, `${name}.${this.config.fonts.format}`);
        const font = await this.fontLoader.loadAsync(fontPath);
        
        this.loadedAssets.set(cacheKey, font);
        return font;
    }

    public async loadSceneGraph(name: string): Promise<SceneGraph> {
        const cacheKey = `scenegraph:${name}`;
        if (this.sceneGraphs.has(cacheKey)) {
            return this.sceneGraphs.get(cacheKey)!;
        }

        const graphPath = path.join(this.config.basePath, 'scenes', `${name}.json`);
        const graphData = await fs.promises.readFile(graphPath, 'utf-8');
        const sceneGraph: SceneGraph = JSON.parse(graphData);

        // Load all assets referenced in the scene graph
        await this.preloadSceneAssets(sceneGraph);

        this.sceneGraphs.set(cacheKey, sceneGraph);
        return sceneGraph;
    }

    private async preloadSceneAssets(graph: SceneGraph): Promise<void> {
        const loadPromises: Promise<any>[] = [];

        // Load models
        graph.nodes.forEach(node => {
            if (node.type === 'model' && node.asset) {
                loadPromises.push(this.loadModel(node.asset));
            }
        });

        // Load textures from materials
        graph.materials.forEach(material => {
            Object.entries(material.properties).forEach(([key, value]) => {
                if (key.endsWith('Map') && typeof value === 'string') {
                    loadPromises.push(this.loadTexture(value));
                }
            });
        });

        await Promise.all(loadPromises);
    }

    public async createSceneFromGraph(name: string): Promise<Group> {
        const graph = await this.loadSceneGraph(name);
        const root = new Group();
        root.name = graph.name;

        // Create scene hierarchy
        await this.createSceneNode(root, graph.nodes[0], graph);

        return root;
    }

    private async createSceneNode(parent: Group, node: SceneNode, graph: SceneGraph): Promise<void> {
        let object: Group;

        switch (node.type) {
            case 'model':
                if (node.asset) {
                    object = await this.loadModel(node.asset);
                } else {
                    object = new Group();
                }
                break;
            case 'light':
                // TODO: Implement light creation
                object = new Group();
                break;
            case 'camera':
                // TODO: Implement camera creation
                object = new Group();
                break;
            default:
                object = new Group();
        }

        // Set transform
        object.position.set(...node.transform.position);
        object.rotation.set(...node.transform.rotation);
        object.scale.set(...node.transform.scale);

        // Set material if specified
        if (node.material) {
            const materialConfig = graph.materials.find(m => m.id === node.material);
            if (materialConfig) {
                // TODO: Apply material configuration
            }
        }

        // Add to parent
        parent.add(object);

        // Process children
        if (node.children) {
            for (const child of node.children) {
                await this.createSceneNode(object, child, graph);
            }
        }
    }

    public dispose(): void {
        // Dispose of all loaded assets
        this.loadedAssets.forEach(asset => {
            if (asset instanceof Texture) {
                asset.dispose();
            } else if (asset instanceof Group) {
                asset.traverse(child => {
                    if (child instanceof Mesh) {
                        if (Array.isArray(child.material)) {
                            child.material.forEach(material => material.dispose());
                        } else {
                            child.material.dispose();
                        }
                        child.geometry.dispose();
                    }
                });
            }
        });

        this.loadedAssets.clear();
        this.sceneGraphs.clear();
    }
} 