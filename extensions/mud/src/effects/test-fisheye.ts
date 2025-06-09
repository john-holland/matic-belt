import * as THREE from 'three';
import { FisheyeCorrection } from './fisheye-correction';

async function testFisheyeCorrection() {
    // Create scene
    const scene = new THREE.Scene();
    
    // Create camera
    const camera = new THREE.PerspectiveCamera(
        75,
        window.innerWidth / window.innerHeight,
        0.1,
        1000
    );
    camera.position.z = 5;

    // Create renderer
    const renderer = new THREE.WebGLRenderer();
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement);

    // Create fisheye correction effect
    const fisheyeCorrection = new FisheyeCorrection(scene, camera, renderer);

    // Create a test object (cube)
    const geometry = new THREE.BoxGeometry();
    const material = new THREE.MeshPhongMaterial({
        color: 0x00ff00,
        wireframe: true
    });
    const cube = new THREE.Mesh(geometry, material);
    scene.add(cube);

    // Add lights
    const ambientLight = new THREE.AmbientLight(0x404040);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(1, 1, 1);
    scene.add(directionalLight);

    // Animation loop
    function animate() {
        requestAnimationFrame(animate);

        // Rotate cube
        cube.rotation.x += 0.01;
        cube.rotation.y += 0.01;

        // Render with fisheye correction
        fisheyeCorrection.render();
    }

    // Handle window resize
    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
        fisheyeCorrection.resize();
    });

    // Add controls for fisheye correction
    const controls = document.createElement('div');
    controls.style.position = 'fixed';
    controls.style.top = '10px';
    controls.style.left = '10px';
    controls.style.background = 'rgba(0, 0, 0, 0.7)';
    controls.style.padding = '10px';
    controls.style.color = 'white';
    controls.style.borderRadius = '5px';

    const strengthSlider = document.createElement('input');
    strengthSlider.type = 'range';
    strengthSlider.min = '0';
    strengthSlider.max = '1';
    strengthSlider.step = '0.1';
    strengthSlider.value = '0.5';
    strengthSlider.style.width = '200px';

    const strengthLabel = document.createElement('div');
    strengthLabel.textContent = 'Correction Strength: 0.5';

    strengthSlider.addEventListener('input', (e) => {
        const value = (e.target as HTMLInputElement).value;
        fisheyeCorrection.setStrength(parseFloat(value));
        strengthLabel.textContent = `Correction Strength: ${value}`;
    });

    controls.appendChild(strengthLabel);
    controls.appendChild(strengthSlider);
    document.body.appendChild(controls);

    // Start animation
    animate();
}

// Run the test
testFisheyeCorrection().catch(console.error); 