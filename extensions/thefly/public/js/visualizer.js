class AudioVisualizer {
    constructor() {
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.renderer = new THREE.WebGLRenderer();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        document.body.appendChild(this.renderer.domElement);

        this.camera.position.z = 5;
        this.soundCircles = [];
        this.setupLighting();
        this.setupSocket();
        this.animate();
    }

    setupLighting() {
        const ambientLight = new THREE.AmbientLight(0x404040);
        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
        directionalLight.position.set(1, 1, 1);
        this.scene.add(ambientLight, directionalLight);
    }

    setupSocket() {
        this.socket = io();
        this.socket.on('connect', () => {
            document.getElementById('status').textContent = 'Status: Connected';
            this.socket.emit('startAudio');
        });

        this.socket.on('audioData', (data) => {
            this.handleAudioData(data);
        });

        this.socket.on('disconnect', () => {
            document.getElementById('status').textContent = 'Status: Disconnected';
        });
    }

    handleAudioData(data) {
        if (data.isSignificantChange) {
            this.createSoundCircle(data);
        }
    }

    createSoundCircle(data) {
        const geometry = new THREE.CircleGeometry(1, 32);
        const material = new THREE.MeshBasicMaterial({
            color: 0x00ff00,
            transparent: true,
            opacity: 0.5
        });
        const circle = new THREE.Mesh(geometry, material);
        
        // Position based on direction data
        const direction = data.direction;
        if (direction.direction !== 'unknown') {
            // Convert direction to position
            const angle = this.getAngleFromDirection(direction.direction);
            circle.position.x = Math.cos(angle) * 3;
            circle.position.y = Math.sin(angle) * 3;
        }

        this.scene.add(circle);
        this.soundCircles.push({
            mesh: circle,
            createdAt: Date.now()
        });
    }

    getAngleFromDirection(direction) {
        // Convert direction string to angle
        const directions = {
            'north': 0,
            'east': Math.PI / 2,
            'south': Math.PI,
            'west': -Math.PI / 2
        };
        return directions[direction] || 0;
    }

    updateSoundCircles() {
        const now = Date.now();
        this.soundCircles = this.soundCircles.filter(({ mesh, createdAt }) => {
            const age = now - createdAt;
            if (age > 2000) { // Remove after 2 seconds
                this.scene.remove(mesh);
                return false;
            }
            // Shrink circle over time
            const scale = 1 - (age / 2000);
            mesh.scale.set(scale, scale, 1);
            mesh.material.opacity = 0.5 * scale;
            return true;
        });
    }

    animate() {
        requestAnimationFrame(() => this.animate());
        this.updateSoundCircles();
        this.renderer.render(this.scene, this.camera);
    }
}

// Initialize visualizer when page loads
window.addEventListener('load', () => {
    new AudioVisualizer();
}); 