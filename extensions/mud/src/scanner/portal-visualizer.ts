import { Scene, Camera, WebGLRenderer, Vector3, Quaternion, Mesh, ShaderMaterial, BufferGeometry, Points, Color } from 'three';
import { MotionNode, MotionEdge, PortalConfig } from './motion-graph';

interface PortalEffect {
    name: string;
    shader: {
        vertex: string;
        fragment: string;
    };
    parameters: Record<string, any>;
}

export class PortalVisualizer {
    private scene: Scene;
    private camera: Camera;
    private renderer: WebGLRenderer;
    private effects: Map<string, PortalEffect>;
    private activePortals: Map<string, {
        source: MotionNode;
        target: MotionNode;
        edge: MotionEdge;
        meshes: Mesh[];
        particles: Points;
        startTime: number;
    }>;

    constructor(scene: Scene, camera: Camera, renderer: WebGLRenderer) {
        this.scene = scene;
        this.camera = camera;
        this.renderer = renderer;
        this.effects = new Map();
        this.activePortals = new Map();
        this.initializeEffects();
    }

    private initializeEffects(): void {
        // Meta-style portal effects
        this.effects.set('particle_flow', {
            name: 'particle_flow',
            shader: {
                vertex: `
                    uniform float time;
                    uniform vec3 targetPosition;
                    varying vec3 vPosition;
                    varying float vAlpha;
                    
                    void main() {
                        vPosition = position;
                        float dist = length(position - targetPosition);
                        vAlpha = 1.0 - smoothstep(0.0, 2.0, dist);
                        vec3 newPos = position + vec3(
                            sin(time + position.x) * 0.1,
                            cos(time + position.y) * 0.1,
                            sin(time + position.z) * 0.1
                        );
                        gl_Position = projectionMatrix * modelViewMatrix * vec4(newPos, 1.0);
                        gl_PointSize = 2.0 * (1.0 - vAlpha);
                    }
                `,
                fragment: `
                    uniform vec3 color;
                    varying float vAlpha;
                    
                    void main() {
                        gl_FragColor = vec4(color, vAlpha);
                    }
                `
            },
            parameters: {
                time: 0,
                color: new Color(0x00ff00),
                targetPosition: new Vector3()
            }
        });

        // Apple-style portal effects
        this.effects.set('fluid_motion', {
            name: 'fluid_motion',
            shader: {
                vertex: `
                    uniform float time;
                    uniform float apertureSize;
                    varying vec2 vUv;
                    varying float vDist;
                    
                    void main() {
                        vUv = uv;
                        vDist = length(position.xy);
                        vec3 newPos = position;
                        newPos.z += sin(vDist * 10.0 + time) * 0.1;
                        gl_Position = projectionMatrix * modelViewMatrix * vec4(newPos, 1.0);
                    }
                `,
                fragment: `
                    uniform vec3 color;
                    uniform float time;
                    varying vec2 vUv;
                    varying float vDist;
                    
                    void main() {
                        float alpha = smoothstep(1.0, 0.0, vDist);
                        vec3 finalColor = mix(color, vec3(1.0), sin(time + vDist * 5.0) * 0.5 + 0.5);
                        gl_FragColor = vec4(finalColor, alpha);
                    }
                `
            },
            parameters: {
                time: 0,
                color: new Color(0xffffff),
                apertureSize: 1.0
            }
        });

        // Google-style portal effects
        this.effects.set('geometric_transition', {
            name: 'geometric_transition',
            shader: {
                vertex: `
                    uniform float time;
                    uniform float progress;
                    varying vec2 vUv;
                    
                    void main() {
                        vUv = uv;
                        vec3 newPos = position;
                        newPos.xy *= 1.0 + sin(time * 2.0) * 0.1;
                        gl_Position = projectionMatrix * modelViewMatrix * vec4(newPos, 1.0);
                    }
                `,
                fragment: `
                    uniform vec3 color;
                    uniform float progress;
                    varying vec2 vUv;
                    
                    void main() {
                        float pattern = step(0.5, mod(vUv.x * 10.0 + vUv.y * 10.0, 1.0));
                        float alpha = smoothstep(0.0, 1.0, progress) * pattern;
                        gl_FragColor = vec4(color, alpha);
                    }
                `
            },
            parameters: {
                time: 0,
                color: new Color(0x4285f4),
                progress: 0
            }
        });
    }

    public createPortal(source: MotionNode, target: MotionNode, edge: MotionEdge): void {
        const portalId = `${edge.source}-${edge.target}`;
        if (this.activePortals.has(portalId)) return;

        const meshes: Mesh[] = [];
        const particles = this.createParticleSystem(edge.metadata.style);
        
        // Create portal aperture
        const apertureGeometry = new BufferGeometry();
        const apertureMaterial = new ShaderMaterial({
            vertexShader: this.effects.get('fluid_motion')!.shader.vertex,
            fragmentShader: this.effects.get('fluid_motion')!.shader.fragment,
            uniforms: {
                time: { value: 0 },
                color: { value: new Color(edge.metadata.style === 'meta' ? 0x00ff00 : 0xffffff) },
                apertureSize: { value: 1.0 }
            },
            transparent: true
        });

        const aperture = new Mesh(apertureGeometry, apertureMaterial);
        aperture.position.copy(source.position);
        meshes.push(aperture);

        // Add to scene
        this.scene.add(aperture);
        this.scene.add(particles);

        this.activePortals.set(portalId, {
            source,
            target,
            edge,
            meshes,
            particles,
            startTime: Date.now()
        });
    }

    private createParticleSystem(style: string): Points {
        const particleCount = 1000;
        const geometry = new BufferGeometry();
        const positions = new Float32Array(particleCount * 3);
        
        for (let i = 0; i < particleCount; i++) {
            positions[i * 3] = (Math.random() - 0.5) * 2;
            positions[i * 3 + 1] = (Math.random() - 0.5) * 2;
            positions[i * 3 + 2] = (Math.random() - 0.5) * 2;
        }
        
        geometry.setAttribute('position', new BufferAttribute(positions, 3));
        
        const material = new ShaderMaterial({
            vertexShader: this.effects.get('particle_flow')!.shader.vertex,
            fragmentShader: this.effects.get('particle_flow')!.shader.fragment,
            uniforms: {
                time: { value: 0 },
                color: { value: new Color(0x00ff00) },
                targetPosition: { value: new Vector3() }
            },
            transparent: true
        });

        return new Points(geometry, material);
    }

    public update(deltaTime: number): void {
        this.activePortals.forEach((portal, id) => {
            const progress = (Date.now() - portal.startTime) / (portal.edge.transitionTime * 1000);
            
            if (progress >= 1.0) {
                this.removePortal(id);
                return;
            }

            // Update portal effects
            portal.meshes.forEach(mesh => {
                const material = mesh.material as ShaderMaterial;
                material.uniforms.time.value += deltaTime;
                material.uniforms.progress.value = progress;
            });

            // Update particles
            const particleMaterial = portal.particles.material as ShaderMaterial;
            particleMaterial.uniforms.time.value += deltaTime;
            particleMaterial.uniforms.targetPosition.value.lerpVectors(
                portal.source.position,
                portal.target.position,
                progress
            );
        });
    }

    private removePortal(id: string): void {
        const portal = this.activePortals.get(id);
        if (!portal) return;

        portal.meshes.forEach(mesh => this.scene.remove(mesh));
        this.scene.remove(portal.particles);
        this.activePortals.delete(id);
    }

    public dispose(): void {
        this.activePortals.forEach((portal, id) => {
            this.removePortal(id);
        });
        this.effects.clear();
    }
} 