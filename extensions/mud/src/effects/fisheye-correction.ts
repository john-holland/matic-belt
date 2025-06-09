import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass';

export class FisheyeCorrection {
    private composer: EffectComposer;
    private fisheyePass: ShaderPass;
    private renderPass: RenderPass;
    private scene: THREE.Scene;
    private camera: THREE.Camera;
    private renderer: THREE.WebGLRenderer;

    constructor(scene: THREE.Scene, camera: THREE.Camera, renderer: THREE.WebGLRenderer) {
        this.scene = scene;
        this.camera = camera;
        this.renderer = renderer;

        // Create composer
        this.composer = new EffectComposer(renderer);
        
        // Create render pass
        this.renderPass = new RenderPass(scene, camera);
        this.composer.addPass(this.renderPass);

        // Create fisheye correction shader
        const fisheyeShader = {
            uniforms: {
                tDiffuse: { value: null },
                strength: { value: 0.5 },
                center: { value: new THREE.Vector2(0.5, 0.5) },
                aspectRatio: { value: 1.0 }
            },
            vertexShader: `
                varying vec2 vUv;
                void main() {
                    vUv = uv;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                uniform sampler2D tDiffuse;
                uniform float strength;
                uniform vec2 center;
                uniform float aspectRatio;
                varying vec2 vUv;

                void main() {
                    vec2 uv = vUv - center;
                    uv.x *= aspectRatio;
                    
                    float dist = length(uv);
                    float factor = 1.0;
                    
                    if (dist > 0.0) {
                        float theta = atan(dist);
                        float r = tan(theta * (1.0 - strength));
                        factor = r / dist;
                    }
                    
                    uv *= factor;
                    uv.x /= aspectRatio;
                    uv += center;
                    
                    gl_FragColor = texture2D(tDiffuse, uv);
                    
                    if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) {
                        gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
                    }
                }
            `
        };

        // Create shader pass
        this.fisheyePass = new ShaderPass(fisheyeShader);
        this.composer.addPass(this.fisheyePass);

        // Set initial values
        this.setStrength(0.5);
        this.setCenter(0.5, 0.5);
        this.updateAspectRatio();
    }

    public setStrength(strength: number): void {
        this.fisheyePass.uniforms.strength.value = Math.max(0.0, Math.min(1.0, strength));
    }

    public setCenter(x: number, y: number): void {
        this.fisheyePass.uniforms.center.value.set(x, y);
    }

    public updateAspectRatio(): void {
        const width = this.renderer.domElement.width;
        const height = this.renderer.domElement.height;
        this.fisheyePass.uniforms.aspectRatio.value = width / height;
    }

    public render(): void {
        this.composer.render();
    }

    public dispose(): void {
        this.composer.dispose();
    }

    public resize(): void {
        this.composer.setSize(
            this.renderer.domElement.width,
            this.renderer.domElement.height
        );
        this.updateAspectRatio();
    }
} 