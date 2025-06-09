import { TorqueAnalyzer, TorqueModelType, CollisionType, TorqueModel } from './torque-analyzer';
import { TorqueVisualizer } from './torque-visualizer';
import * as THREE from 'three';
import * as XLSX from 'xlsx';

interface PerformanceMetrics {
    fps: number;
    frameTime: number;
    drawCalls: number;
    triangles: number;
    memoryUsage: number;
}

interface PerformanceReport {
    timestamp: string;
    modelCount: number;
    metrics: PerformanceMetrics;
    modelTypes: {
        [key: string]: number;
    };
    collisionTypes: {
        [key: string]: number;
    };
}

class PerformanceMonitor {
    private metrics: PerformanceMetrics = {
        fps: 0,
        frameTime: 0,
        drawCalls: 0,
        triangles: 0,
        memoryUsage: 0
    };
    private frameCount = 0;
    private lastTime = performance.now();
    private statsPanel: HTMLDivElement;
    private reports: PerformanceReport[] = [];
    private exportButton: HTMLButtonElement;

    constructor() {
        this.statsPanel = document.createElement('div');
        this.statsPanel.style.cssText = `
            position: fixed;
            top: 10px;
            right: 10px;
            background: rgba(0, 0, 0, 0.8);
            color: #fff;
            padding: 10px;
            font-family: monospace;
            border-radius: 4px;
            z-index: 1000;
        `;
        document.body.appendChild(this.statsPanel);

        // Add export button
        this.exportButton = document.createElement('button');
        this.exportButton.textContent = 'Export Report';
        this.exportButton.style.cssText = `
            position: fixed;
            top: 10px;
            left: 10px;
            padding: 8px 16px;
            background: #4CAF50;
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-family: Arial, sans-serif;
        `;
        this.exportButton.addEventListener('click', () => this.exportReport());
        document.body.appendChild(this.exportButton);
    }

    public update(renderer: THREE.WebGLRenderer, models: Map<string, any>): void {
        const now = performance.now();
        const delta = now - this.lastTime;
        this.frameCount++;

        if (delta >= 1000) {
            this.metrics.fps = Math.round((this.frameCount * 1000) / delta);
            this.metrics.frameTime = delta / this.frameCount;
            this.metrics.drawCalls = renderer.info.render.calls;
            this.metrics.triangles = renderer.info.render.triangles;
            this.metrics.memoryUsage = renderer.info.memory.geometries;

            // Collect model type statistics
            const modelTypes: { [key: string]: number } = {};
            const collisionTypes: { [key: string]: number } = {};
            models.forEach((model) => {
                modelTypes[model.type] = (modelTypes[model.type] || 0) + 1;
                collisionTypes[model.collisions.type] = (collisionTypes[model.collisions.type] || 0) + 1;
            });

            // Add report
            this.reports.push({
                timestamp: new Date().toISOString(),
                modelCount: models.size,
                metrics: { ...this.metrics },
                modelTypes,
                collisionTypes
            });

            this.updateStatsPanel();
            this.frameCount = 0;
            this.lastTime = now;
        }
    }

    private updateStatsPanel(): void {
        this.statsPanel.innerHTML = `
            FPS: ${this.metrics.fps}<br>
            Frame Time: ${this.metrics.frameTime.toFixed(2)}ms<br>
            Draw Calls: ${this.metrics.drawCalls}<br>
            Triangles: ${this.metrics.triangles}<br>
            Memory (Geometries): ${this.metrics.memoryUsage}
        `;
    }

    private exportReport(): void {
        // Create workbook
        const wb = XLSX.utils.book_new();
        
        // Create performance metrics sheet
        const metricsData = this.reports.map(report => ({
            Timestamp: report.timestamp,
            'Model Count': report.modelCount,
            FPS: report.metrics.fps,
            'Frame Time (ms)': report.metrics.frameTime.toFixed(2),
            'Draw Calls': report.metrics.drawCalls,
            Triangles: report.metrics.triangles,
            'Memory Usage': report.metrics.memoryUsage
        }));
        const metricsSheet = XLSX.utils.json_to_sheet(metricsData);
        XLSX.utils.book_append_sheet(wb, metricsSheet, 'Performance Metrics');

        // Create model type distribution sheet
        const modelTypeData = this.reports.map(report => ({
            Timestamp: report.timestamp,
            ...report.modelTypes
        }));
        const modelTypeSheet = XLSX.utils.json_to_sheet(modelTypeData);
        XLSX.utils.book_append_sheet(wb, modelTypeSheet, 'Model Types');

        // Create collision type distribution sheet
        const collisionTypeData = this.reports.map(report => ({
            Timestamp: report.timestamp,
            ...report.collisionTypes
        }));
        const collisionTypeSheet = XLSX.utils.json_to_sheet(collisionTypeData);
        XLSX.utils.book_append_sheet(wb, collisionTypeSheet, 'Collision Types');

        // Save workbook
        XLSX.writeFile(wb, `torque_performance_report_${new Date().toISOString()}.xlsx`);
    }

    public dispose(): void {
        this.statsPanel.remove();
        this.exportButton.remove();
    }
}

function createTestScene(visualizer: TorqueVisualizer, modelCount: number): void {
    const modelTypes = Object.values(TorqueModelType);
    const collisionTypes = Object.values(CollisionType);

    for (let i = 0; i < modelCount; i++) {
        const type = modelTypes[i % modelTypes.length];
        const collisionType = collisionTypes[i % collisionTypes.length];
        
        const model: TorqueModel = {
            type,
            properties: {
                name: `model_${i}`,
                path: `/models/${type.toLowerCase()}_${i}`,
                position: [
                    (Math.random() - 0.5) * 20,
                    (Math.random() - 0.5) * 20,
                    (Math.random() - 0.5) * 20
                ],
                rotation: [
                    Math.random() * Math.PI * 2,
                    Math.random() * Math.PI * 2,
                    Math.random() * Math.PI * 2
                ],
                scale: [
                    0.5 + Math.random(),
                    0.5 + Math.random(),
                    0.5 + Math.random()
                ],
                lodLevels: 3,
                detailLevels: [
                    { distance: 0, modelPath: `/models/${type.toLowerCase()}_${i}_high` },
                    { distance: 10, modelPath: `/models/${type.toLowerCase()}_${i}_med` },
                    { distance: 20, modelPath: `/models/${type.toLowerCase()}_${i}_low` }
                ]
            },
            animations: [],
            materials: [{
                properties: {
                    diffuseColor: [
                        Math.random(),
                        Math.random(),
                        Math.random()
                    ],
                    reflectivity: Math.random(),
                    shininess: Math.random(),
                    transparency: Math.random() * 0.5,
                    emissiveColor: [0, 0, 0]
                }
            }],
            collisions: {
                type: collisionType,
                bounds: {
                    min: [-1, -1, -1],
                    max: [1, 1, 1]
                },
                convexHulls: collisionType === CollisionType.Convex ? [{
                    vertices: Array.from({ length: 8 }, () => [
                        Math.random() - 0.5,
                        Math.random() - 0.5,
                        Math.random() - 0.5
                    ] as [number, number, number]),
                    faces: [
                        [0, 1, 2], [0, 2, 3],
                        [4, 5, 6], [4, 6, 7],
                        [0, 4, 7], [0, 7, 3],
                        [1, 5, 6], [1, 6, 2]
                    ]
                }] : []
            },
            physics: {
                mass: Math.random() * 10,
                friction: Math.random(),
                restitution: Math.random(),
                gravityScale: Math.random(),
                linearDamping: Math.random(),
                angularDamping: Math.random()
            }
        };

        visualizer.addModel(model);
    }
}

function runPerformanceTest() {
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

    // Create performance monitor
    const monitor = new PerformanceMonitor();

    // Create test scene with 100 models
    createTestScene(visualizer, 100);

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

    // Update performance metrics
    function updateMetrics() {
        monitor.update(visualizer['renderer'], visualizer['models']);
        requestAnimationFrame(updateMetrics);
    }
    updateMetrics();

    // Clean up on window unload
    window.addEventListener('unload', () => {
        monitor.dispose();
        visualizer.dispose();
    });
}

// Run test when DOM is ready
if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', runPerformanceTest);
    } else {
        runPerformanceTest();
    }
} 