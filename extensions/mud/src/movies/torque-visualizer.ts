import { TorqueModel, TorqueModelType, CollisionType } from './torque-analyzer';
import * as THREE from 'three';

interface VisualizationConfig {
    container: HTMLElement;
    width: number;
    height: number;
    backgroundColor: string;
}

interface ModelView {
    model: TorqueModel;
    mesh: THREE.Mesh;
    wireframe: THREE.LineSegments;
    boundingBox: THREE.Box3Helper;
    collisionMesh?: THREE.Mesh;
}

export class TorqueVisualizer {
    private scene: THREE.Scene;
    private camera: THREE.PerspectiveCamera;
    private renderer: THREE.WebGLRenderer;
    private models: Map<string, ModelView> = new Map();
    private controls: THREE.OrbitControls;
    private grid: THREE.GridHelper;
    private axes: THREE.AxesHelper;

    constructor(config: VisualizationConfig) {
        // Initialize Three.js scene
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(config.backgroundColor);

        // Set up camera
        this.camera = new THREE.PerspectiveCamera(
            75,
            config.width / config.height,
            0.1,
            1000
        );
        this.camera.position.set(5, 5, 5);

        // Set up renderer
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(config.width, config.height);
        config.container.appendChild(this.renderer.domElement);

        // Set up controls
        this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;

        // Add grid and axes
        this.grid = new THREE.GridHelper(10, 10);
        this.scene.add(this.grid);

        this.axes = new THREE.AxesHelper(5);
        this.scene.add(this.axes);

        // Start animation loop
        this.animate();
    }

    public addModel(model: TorqueModel): void {
        // Create Three.js mesh based on model type
        const mesh = this.createMesh(model);
        const wireframe = this.createWireframe(mesh);
        const boundingBox = this.createBoundingBox(model);
        const collisionMesh = this.createCollisionMesh(model);

        // Add to scene
        this.scene.add(mesh);
        this.scene.add(wireframe);
        this.scene.add(boundingBox);
        if (collisionMesh) {
            this.scene.add(collisionMesh);
        }

        // Store model view
        this.models.set(model.properties.name, {
            model,
            mesh,
            wireframe,
            boundingBox,
            collisionMesh
        });
    }

    private createMesh(model: TorqueModel): THREE.Mesh {
        let geometry: THREE.BufferGeometry;
        
        // Create geometry based on model type
        switch (model.type) {
            case TorqueModelType.StaticMesh:
                geometry = new THREE.BoxGeometry(1, 1, 1);
                break;
            case TorqueModelType.SkinnedMesh:
                geometry = new THREE.BoxGeometry(1, 2, 1);
                break;
            case TorqueModelType.ParticleEmitter:
                geometry = new THREE.SphereGeometry(0.5, 32, 32);
                break;
            case TorqueModelType.Decal:
                geometry = new THREE.PlaneGeometry(1, 1);
                break;
            case TorqueModelType.Water:
                geometry = new THREE.PlaneGeometry(10, 10, 10, 10);
                break;
            case TorqueModelType.Terrain:
                geometry = new THREE.PlaneGeometry(10, 10, 10, 10);
                break;
            case TorqueModelType.Interior:
                geometry = new THREE.BoxGeometry(2, 2, 2);
                break;
            case TorqueModelType.Shape:
                geometry = new THREE.CylinderGeometry(0.5, 0.5, 1, 32);
                break;
            case TorqueModelType.Vehicle:
                geometry = new THREE.BoxGeometry(2, 1, 4);
                break;
            case TorqueModelType.Player:
                geometry = new THREE.CapsuleGeometry(0.5, 1, 4, 8);
                break;
            default:
                geometry = new THREE.BoxGeometry(1, 1, 1);
        }

        // Create material
        const material = this.createMaterial(model.materials[0]);

        // Create mesh
        const mesh = new THREE.Mesh(geometry, material);

        // Set transform
        mesh.position.set(...model.properties.position);
        mesh.rotation.set(...model.properties.rotation);
        mesh.scale.set(...model.properties.scale);

        return mesh;
    }

    private createWireframe(mesh: THREE.Mesh): THREE.LineSegments {
        const wireframe = new THREE.LineSegments(
            new THREE.WireframeGeometry(mesh.geometry),
            new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5 })
        );
        wireframe.position.copy(mesh.position);
        wireframe.rotation.copy(mesh.rotation);
        wireframe.scale.copy(mesh.scale);
        return wireframe;
    }

    private createBoundingBox(model: TorqueModel): THREE.Box3Helper {
        const box = new THREE.Box3().setFromObject(this.createMesh(model));
        return new THREE.Box3Helper(box, 0xffff00);
    }

    private createCollisionMesh(model: TorqueModel): THREE.Mesh | undefined {
        if (model.collisions.type === CollisionType.None) return undefined;

        let geometry: THREE.BufferGeometry;
        const material = new THREE.MeshBasicMaterial({
            color: 0xff0000,
            wireframe: true,
            transparent: true,
            opacity: 0.5,
            depthWrite: false,
            side: THREE.DoubleSide
        });

        switch (model.collisions.type) {
            case CollisionType.Box:
                geometry = new THREE.BoxGeometry(1, 1, 1);
                break;
            case CollisionType.Sphere:
                geometry = new THREE.SphereGeometry(0.5, 16, 16);
                break;
            case CollisionType.Capsule:
                geometry = new THREE.CapsuleGeometry(0.5, 1, 8, 8);
                break;
            case CollisionType.Mesh:
            case CollisionType.Convex:
                const vertices = model.collisions.convexHulls[0]?.vertices || [];
                const faces = model.collisions.convexHulls[0]?.faces || [];
                
                const positionArray = new Float32Array(vertices.flat());
                const indexArray = new Uint16Array(faces.flat());
                
                geometry = new THREE.BufferGeometry();
                geometry.setAttribute('position', new THREE.BufferAttribute(positionArray, 3));
                geometry.setIndex(new THREE.BufferAttribute(indexArray, 1));
                
                geometry.computeVertexNormals();
                break;
            default:
                return undefined;
        }

        geometry.computeBoundingSphere();
        geometry.computeBoundingBox();

        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.set(...model.properties.position);
        mesh.rotation.set(...model.properties.rotation);
        mesh.scale.set(...model.properties.scale);

        const label = this.createCollisionLabel(model.collisions.type);
        if (label) {
            mesh.add(label);
        }

        return mesh;
    }

    private createCollisionLabel(type: CollisionType): THREE.Sprite | undefined {
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        if (!context) return undefined;

        canvas.width = 128;
        canvas.height = 64;

        context.fillStyle = 'rgba(0, 0, 0, 0.7)';
        context.fillRect(0, 0, canvas.width, canvas.height);

        context.font = '24px Arial';
        context.fillStyle = '#ffffff';
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.fillText(type, canvas.width / 2, canvas.height / 2);

        const texture = new THREE.CanvasTexture(canvas);
        const material = new THREE.SpriteMaterial({ map: texture });
        const sprite = new THREE.Sprite(material);
        sprite.scale.set(1, 0.5, 1);
        sprite.position.set(0, 1.5, 0);

        return sprite;
    }

    private createMaterial(material: any): THREE.Material {
        const mat = new THREE.MeshStandardMaterial({
            color: new THREE.Color(...material.properties.diffuseColor),
            metalness: material.properties.reflectivity,
            roughness: 1 - material.properties.shininess,
            transparent: material.properties.transparency > 0,
            opacity: 1 - material.properties.transparency
        });

        // Load textures if available
        if (material.diffuseMap) {
            const texture = new THREE.TextureLoader().load(material.diffuseMap);
            mat.map = texture;
        }
        if (material.normalMap) {
            const texture = new THREE.TextureLoader().load(material.normalMap);
            mat.normalMap = texture;
        }
        if (material.specularMap) {
            const texture = new THREE.TextureLoader().load(material.specularMap);
            mat.metalnessMap = texture;
        }
        if (material.emissiveMap) {
            const texture = new THREE.TextureLoader().load(material.emissiveMap);
            mat.emissiveMap = texture;
            mat.emissive = new THREE.Color(...material.properties.emissiveColor);
        }

        return mat;
    }

    private animate(): void {
        requestAnimationFrame(() => this.animate());

        // Update controls
        this.controls.update();

        // Render scene
        this.renderer.render(this.scene, this.camera);
    }

    public removeModel(name: string): void {
        const modelView = this.models.get(name);
        if (modelView) {
            this.scene.remove(modelView.mesh);
            this.scene.remove(modelView.wireframe);
            this.scene.remove(modelView.boundingBox);
            if (modelView.collisionMesh) {
                this.scene.remove(modelView.collisionMesh);
            }
            this.models.delete(name);
        }
    }

    public clear(): void {
        for (const [name] of this.models) {
            this.removeModel(name);
        }
    }

    public dispose(): void {
        this.clear();
        this.renderer.dispose();
        this.controls.dispose();
    }
} 