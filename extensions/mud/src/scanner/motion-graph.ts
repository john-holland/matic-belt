import { Vector3, Quaternion, Matrix4 } from 'three';
import * as tf from '@tensorflow/tfjs';
import { EventEmitter } from 'events';

interface MotionNode {
    id: string;
    position: Vector3;
    rotation: Quaternion;
    scale: Vector3;
    velocity: Vector3;
    angularVelocity: Vector3;
    confidence: number;
    timestamp: number;
}

interface MotionEdge {
    source: string;
    target: string;
    weight: number;
    transitionTime: number;
    transitionType: 'portal' | 'blend' | 'warp';
    metadata: {
        confidence: number;
        style: string;
        effects: string[];
    };
}

interface PortalConfig {
    apertureSize: number;
    transitionDuration: number;
    effectStyle: 'meta' | 'apple' | 'google' | 'custom';
    blurRadius: number;
    particleDensity: number;
    colorScheme: string[];
}

export class MotionGraphManager extends EventEmitter {
    private nodes: Map<string, MotionNode> = new Map();
    private edges: Map<string, MotionEdge> = new Map();
    private model: tf.LayersModel | null = null;
    private portalConfig: PortalConfig;
    private isInitialized: boolean = false;

    constructor(config: Partial<PortalConfig> = {}) {
        super();
        this.portalConfig = {
            apertureSize: config.apertureSize || 1.0,
            transitionDuration: config.transitionDuration || 0.5,
            effectStyle: config.effectStyle || 'meta',
            blurRadius: config.blurRadius || 0.1,
            particleDensity: config.particleDensity || 1000,
            colorScheme: config.colorScheme || ['#00ff00', '#0000ff', '#ff0000']
        };
    }

    public async initialize(): Promise<void> {
        if (this.isInitialized) return;

        // Initialize TensorFlow model for motion prediction
        this.model = await this.createMotionModel();
        this.isInitialized = true;

        this.emit('initialized', {
            type: 'motion-graph',
            content: 'Motion graph system initialized',
            timestamp: Date.now()
        });
    }

    private async createMotionModel(): Promise<tf.LayersModel> {
        const model = tf.sequential();
        
        // Input layer for motion features
        model.add(tf.layers.dense({
            units: 64,
            activation: 'relu',
            inputShape: [12] // 3D position, rotation, velocity, angular velocity
        }));

        // Hidden layers for motion analysis
        model.add(tf.layers.dense({ units: 128, activation: 'relu' }));
        model.add(tf.layers.dropout({ rate: 0.2 }));
        model.add(tf.layers.dense({ units: 64, activation: 'relu' }));

        // Output layer for motion prediction
        model.add(tf.layers.dense({
            units: 12,
            activation: 'linear' // Predict next motion state
        }));

        model.compile({
            optimizer: tf.train.adam(0.001),
            loss: 'meanSquaredError'
        });

        return model;
    }

    public addNode(node: MotionNode): void {
        this.nodes.set(node.id, node);
        this.emit('nodeAdded', {
            type: 'motion-node',
            content: `Added motion node ${node.id}`,
            timestamp: Date.now(),
            data: node
        });
    }

    public addEdge(edge: MotionEdge): void {
        const edgeId = `${edge.source}-${edge.target}`;
        this.edges.set(edgeId, edge);
        this.emit('edgeAdded', {
            type: 'motion-edge',
            content: `Added motion edge ${edgeId}`,
            timestamp: Date.now(),
            data: edge
        });
    }

    public async predictMotion(nodeId: string, timeSteps: number = 10): Promise<MotionNode[]> {
        if (!this.model || !this.nodes.has(nodeId)) {
            throw new Error('Model not initialized or node not found');
        }

        const node = this.nodes.get(nodeId)!;
        const predictions: MotionNode[] = [];

        // Convert current state to tensor
        let currentState = tf.tensor2d([[
            node.position.x, node.position.y, node.position.z,
            node.rotation.x, node.rotation.y, node.rotation.z, node.rotation.w,
            node.velocity.x, node.velocity.y, node.velocity.z,
            node.angularVelocity.x, node.angularVelocity.y, node.angularVelocity.z
        ]]);

        // Predict future states
        for (let i = 0; i < timeSteps; i++) {
            const prediction = this.model.predict(currentState) as tf.Tensor;
            const predictedState = await prediction.array() as number[][];
            
            // Create new motion node from prediction
            const predictedNode: MotionNode = {
                id: `${nodeId}_pred_${i}`,
                position: new Vector3(
                    predictedState[0][0],
                    predictedState[0][1],
                    predictedState[0][2]
                ),
                rotation: new Quaternion(
                    predictedState[0][3],
                    predictedState[0][4],
                    predictedState[0][5],
                    predictedState[0][6]
                ),
                velocity: new Vector3(
                    predictedState[0][7],
                    predictedState[0][8],
                    predictedState[0][9]
                ),
                angularVelocity: new Vector3(
                    predictedState[0][10],
                    predictedState[0][11],
                    predictedState[0][12]
                ),
                confidence: this.calculateConfidence(predictedState[0]),
                timestamp: node.timestamp + (i + 1) * 16.67 // Assuming 60fps
            };

            predictions.push(predictedNode);
            currentState = prediction;
        }

        return predictions;
    }

    public async createPortalTransition(
        sourceNode: MotionNode,
        targetNode: MotionNode,
        style: 'meta' | 'apple' | 'google' | 'custom' = 'meta'
    ): Promise<MotionEdge> {
        const transitionTime = this.calculateTransitionTime(sourceNode, targetNode);
        const effects = this.getPortalEffects(style);

        const edge: MotionEdge = {
            source: sourceNode.id,
            target: targetNode.id,
            weight: this.calculateTransitionWeight(sourceNode, targetNode),
            transitionTime,
            transitionType: 'portal',
            metadata: {
                confidence: this.calculateConfidence([
                    ...this.nodeToArray(sourceNode),
                    ...this.nodeToArray(targetNode)
                ]),
                style,
                effects
            }
        };

        this.addEdge(edge);
        return edge;
    }

    private calculateTransitionTime(source: MotionNode, target: MotionNode): number {
        const distance = source.position.distanceTo(target.position);
        const rotationDiff = this.quaternionDifference(source.rotation, target.rotation);
        
        // Base time on distance and rotation difference
        return Math.max(
            this.portalConfig.transitionDuration,
            distance * 0.1 + rotationDiff * 0.2
        );
    }

    private calculateTransitionWeight(source: MotionNode, target: MotionNode): number {
        const positionWeight = 1 - (source.position.distanceTo(target.position) / 10);
        const rotationWeight = 1 - this.quaternionDifference(source.rotation, target.rotation);
        const velocityWeight = 1 - (source.velocity.distanceTo(target.velocity) / 5);
        
        return (positionWeight + rotationWeight + velocityWeight) / 3;
    }

    private getPortalEffects(style: string): string[] {
        const effects: Record<string, string[]> = {
            meta: ['particle_flow', 'light_beam', 'spatial_warp'],
            apple: ['fluid_motion', 'glass_break', 'light_rings'],
            google: ['geometric_transition', 'color_shift', 'wave_distortion'],
            custom: ['custom_effect_1', 'custom_effect_2', 'custom_effect_3']
        };

        return effects[style] || effects.meta;
    }

    private nodeToArray(node: MotionNode): number[] {
        return [
            node.position.x, node.position.y, node.position.z,
            node.rotation.x, node.rotation.y, node.rotation.z, node.rotation.w,
            node.velocity.x, node.velocity.y, node.velocity.z,
            node.angularVelocity.x, node.angularVelocity.y, node.angularVelocity.z
        ];
    }

    private quaternionDifference(q1: Quaternion, q2: Quaternion): number {
        return 1 - Math.abs(q1.dot(q2));
    }

    private calculateConfidence(state: number[]): number {
        // Simple confidence calculation based on state validity
        const positionValid = state.slice(0, 3).every(v => !isNaN(v) && isFinite(v));
        const rotationValid = state.slice(3, 7).every(v => !isNaN(v) && isFinite(v));
        const velocityValid = state.slice(7, 10).every(v => !isNaN(v) && isFinite(v));
        const angularValid = state.slice(10, 13).every(v => !isNaN(v) && isFinite(v));

        return (positionValid && rotationValid && velocityValid && angularValid) ? 1.0 : 0.0;
    }

    public getPortalConfig(): PortalConfig {
        return { ...this.portalConfig };
    }

    public updatePortalConfig(config: Partial<PortalConfig>): void {
        this.portalConfig = {
            ...this.portalConfig,
            ...config
        };
    }
} 