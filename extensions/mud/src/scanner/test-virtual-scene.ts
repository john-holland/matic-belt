import { VirtualSceneManager } from './virtual-scene';
import { Vector3, Quaternion } from 'three';

async function testVirtualScene() {
    const sceneManager = new VirtualSceneManager();

    // Load a magical castle scene
    await sceneManager.loadScene({
        name: 'Magical Castle',
        modelUrl: 'models/castle.glb', // TODO: Add actual model
        lighting: {
            ambient: 0.4,
            directional: 1.0,
            color: '#ffd700'
        },
        effects: {
            edgeDetection: true,
            bloom: true,
            depthOfField: true
        },
        wifiPoints: {
            count: 50,
            color: '#00ff00',
            pulseSpeed: 2.0
        }
    });

    // Request camera access
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        await sceneManager.addUserOverlay('user1', stream);

        // Animation loop
        let lastTime = performance.now();
        function animate() {
            const currentTime = performance.now();
            const deltaTime = (currentTime - lastTime) / 1000;
            lastTime = currentTime;

            // Update user position (simulated movement)
            const time = currentTime / 1000;
            const position = new Vector3(
                Math.sin(time) * 2,
                Math.cos(time) * 0.5,
                -2
            );
            const rotation = new Quaternion().setFromEuler({
                x: Math.sin(time * 0.5) * 0.1,
                y: Math.cos(time * 0.5) * 0.1,
                z: 0
            });

            sceneManager.updateUserPosition('user1', position, rotation);
            sceneManager.update(deltaTime);
            requestAnimationFrame(animate);
        }

        // Start animation
        animate();

        // Handle window resize
        window.addEventListener('resize', () => {
            // TODO: Update camera and renderer
        });

    } catch (error) {
        console.error('Error accessing camera:', error);
    }
}

// Run the test
testVirtualScene().catch(console.error); 