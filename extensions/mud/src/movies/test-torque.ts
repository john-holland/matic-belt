import { TorqueAnalyzer, TorqueModelType, CollisionType } from './torque-analyzer';
import { TorqueVisualizer } from './torque-visualizer';

function createTestModel(name: string, type: TorqueModelType): any {
    return {
        type,
        properties: {
            name,
            position: [0, 0, 0],
            rotation: [0, 0, 0],
            scale: [1, 1, 1]
        },
        animations: [],
        materials: [{
            properties: {
                diffuseColor: [0.5, 0.5, 0.5],
                reflectivity: 0.5,
                shininess: 0.5,
                transparency: 0,
                emissiveColor: [0, 0, 0]
            }
        }],
        collisions: {
            type: CollisionType.Box,
            convexHulls: []
        },
        physics: {
            mass: 1,
            friction: 0.5,
            restitution: 0.5,
            gravityScale: 1
        }
    };
}

function testTorqueVisualization() {
    // Create container
    const container = document.createElement('div');
    container.style.width = '800px';
    container.style.height = '600px';
    document.body.appendChild(container);

    // Create visualizer
    const visualizer = new TorqueVisualizer({
        container,
        width: 800,
        height: 600,
        backgroundColor: '#1a1a1a'
    });

    // Create test models
    const models = [
        createTestModel('staticMesh', TorqueModelType.StaticMesh),
        createTestModel('skinnedMesh', TorqueModelType.SkinnedMesh),
        createTestModel('particleEmitter', TorqueModelType.ParticleEmitter),
        createTestModel('decal', TorqueModelType.Decal),
        createTestModel('water', TorqueModelType.Water),
        createTestModel('terrain', TorqueModelType.Terrain),
        createTestModel('interior', TorqueModelType.Interior),
        createTestModel('shape', TorqueModelType.Shape),
        createTestModel('vehicle', TorqueModelType.Vehicle),
        createTestModel('player', TorqueModelType.Player)
    ];

    // Position models in a grid
    models.forEach((model, index) => {
        const row = Math.floor(index / 3);
        const col = index % 3;
        model.properties.position = [col * 3 - 3, 0, row * 3 - 3];
        visualizer.addModel(model);
    });

    // Add styles
    const style = document.createElement('style');
    style.textContent = `
        body {
            margin: 0;
            padding: 20px;
            background: #000;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
            font-family: Arial, sans-serif;
        }
        canvas {
            border: 1px solid #333;
            border-radius: 4px;
        }
    `;
    document.head.appendChild(style);
}

// Run test when DOM is ready
if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', testTorqueVisualization);
    } else {
        testTorqueVisualization();
    }
} 