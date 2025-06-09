import { Scene, PerspectiveCamera, WebGLRenderer, AmbientLight, DirectionalLight } from 'three';
import { ContentManager } from './manager';

async function testContentManager() {
    // Initialize content manager
    const contentManager = new ContentManager({
        basePath: './assets',
        shaders: {
            vertex: 'shaders/vertex',
            fragment: 'shaders/fragment'
        },
        models: {
            path: 'models',
            draco: true
        },
        textures: {
            path: 'textures',
            formats: ['png', 'jpg', 'webp']
        },
        sounds: {
            path: 'sounds',
            formats: ['mp3', 'wav', 'ogg']
        },
        fonts: {
            path: 'fonts',
            format: 'json'
        }
    });

    // Create scene
    const scene = new Scene();
    const camera = new PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    const renderer = new WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement);

    // Add lights
    const ambientLight = new AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);

    const directionalLight = new DirectionalLight(0xffffff, 1);
    directionalLight.position.set(5, 5, 5);
    scene.add(directionalLight);

    // Load and create scene from graph
    const sceneRoot = await contentManager.createSceneFromGraph('magical_castle');
    scene.add(sceneRoot);

    // Position camera
    camera.position.set(0, 5, 10);
    camera.lookAt(0, 0, 0);

    // Animation loop
    function animate() {
        requestAnimationFrame(animate);
        renderer.render(scene, camera);
    }
    animate();

    // Handle window resize
    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });

    // Example of loading other assets
    const portalShader = await contentManager.loadShader('portal');
    const backgroundMusic = await contentManager.loadSound('ambient_music');
    const mainFont = await contentManager.loadFont('main');

    // Start background music
    backgroundMusic.setLoop(true);
    backgroundMusic.setVolume(0.5);
    backgroundMusic.play();

    // Cleanup on window close
    window.addEventListener('beforeunload', () => {
        contentManager.dispose();
        renderer.dispose();
    });
}

// Run the test
testContentManager().catch(console.error); 