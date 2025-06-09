import { Scene, PerspectiveCamera, WebGLRenderer, Vector3, Quaternion, AmbientLight, DirectionalLight } from 'three';
import { MotionGraphManager } from './motion-graph';
import { PortalVisualizer } from './portal-visualizer';

async function testPortalEffects() {
    // Initialize Three.js scene
    const scene = new Scene();
    const camera = new PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    const renderer = new WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement);

    // Add lighting
    const ambientLight = new AmbientLight(0x404040);
    const directionalLight = new DirectionalLight(0xffffff, 1);
    directionalLight.position.set(1, 1, 1);
    scene.add(ambientLight, directionalLight);

    // Initialize motion graph and portal visualizer
    const motionGraph = new MotionGraphManager();
    await motionGraph.initialize();
    const portalVisualizer = new PortalVisualizer(scene, camera, renderer);

    // Create test nodes
    const sourceNode = {
        id: 'source',
        position: new Vector3(-2, 0, 0),
        rotation: new Quaternion(),
        scale: new Vector3(1, 1, 1),
        velocity: new Vector3(),
        angularVelocity: new Vector3(),
        confidence: 1.0,
        timestamp: Date.now()
    };

    const targetNode = {
        id: 'target',
        position: new Vector3(2, 0, 0),
        rotation: new Quaternion(),
        scale: new Vector3(1, 1, 1),
        velocity: new Vector3(),
        angularVelocity: new Vector3(),
        confidence: 1.0,
        timestamp: Date.now()
    };

    // Add nodes to motion graph
    motionGraph.addNode(sourceNode);
    motionGraph.addNode(targetNode);

    // Create portal transitions with different styles
    const styles: ('meta' | 'apple' | 'google')[] = ['meta', 'apple', 'google'];
    let currentStyleIndex = 0;

    // Create initial portal
    const edge = await motionGraph.createPortalTransition(sourceNode, targetNode, styles[currentStyleIndex]);
    portalVisualizer.createPortal(sourceNode, targetNode, edge);

    // Animation loop
    let lastTime = performance.now();
    function animate() {
        const currentTime = performance.now();
        const deltaTime = (currentTime - lastTime) / 1000;
        lastTime = currentTime;

        // Update portal effects
        portalVisualizer.update(deltaTime);

        // Render scene
        renderer.render(scene, camera);
        requestAnimationFrame(animate);
    }

    // Start animation
    animate();

    // Switch portal styles every 5 seconds
    setInterval(() => {
        currentStyleIndex = (currentStyleIndex + 1) % styles.length;
        const newEdge = motionGraph.createPortalTransition(sourceNode, targetNode, styles[currentStyleIndex]);
        portalVisualizer.createPortal(sourceNode, targetNode, newEdge);
    }, 5000);

    // Handle window resize
    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });
}

// Run the test
testPortalEffects().catch(console.error); 