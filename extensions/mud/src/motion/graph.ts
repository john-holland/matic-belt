import * as tf from '@tensorflow/tfjs';

interface MotionNode {
    id: string;
    motion: tf.Tensor;
    style: string;
    weight: number;
}

interface MotionEdge {
    from: string;
    to: string;
    weight: number;
    transition: tf.Tensor;
}

export class MotionGraph {
    private nodes: Map<string, MotionNode> = new Map();
    private edges: Map<string, MotionEdge[]> = new Map();
    private currentMotion: tf.Tensor | null = null;
    private currentStyle: string = '';

    constructor() {
        // Initialize with some basic motion patterns
        this.initializeBasicMotions();
    }

    private initializeBasicMotions(): void {
        // Add basic motion patterns for different dance styles
        this.addMotionNode('hip-hop-basic', this.createBasicMotion(1.0), 'hip-hop', 1.0);
        this.addMotionNode('ballet-basic', this.createBasicMotion(0.5), 'ballet', 1.0);
        this.addMotionNode('jazz-basic', this.createBasicMotion(0.8), 'jazz', 1.0);
        this.addMotionNode('contemporary-basic', this.createBasicMotion(0.7), 'contemporary', 1.0);

        // Add transitions between styles
        this.addMotionEdge('hip-hop-basic', 'ballet-basic', 0.5);
        this.addMotionEdge('ballet-basic', 'jazz-basic', 0.5);
        this.addMotionEdge('jazz-basic', 'contemporary-basic', 0.5);
        this.addMotionEdge('contemporary-basic', 'hip-hop-basic', 0.5);
    }

    private createBasicMotion(intensity: number): tf.Tensor {
        // Create a basic motion tensor with the given intensity
        return tf.tensor1d([intensity, intensity * 0.8, intensity * 0.6]);
    }

    public addMotionNode(id: string, motion: tf.Tensor, style: string, weight: number): void {
        this.nodes.set(id, { id, motion, style, weight });
        this.edges.set(id, []);
    }

    public addMotionEdge(from: string, to: string, weight: number): void {
        const fromNode = this.nodes.get(from);
        const toNode = this.nodes.get(to);
        
        if (!fromNode || !toNode) {
            throw new Error('Invalid node IDs');
        }

        // Create transition tensor
        const transition = tf.sub(toNode.motion, fromNode.motion);
        
        const edge: MotionEdge = {
            from,
            to,
            weight,
            transition
        };

        this.edges.get(from)?.push(edge);
    }

    public async getCurrentMotion(): Promise<tf.Tensor> {
        if (!this.currentMotion) {
            // Start with a random basic motion
            const basicMotions = Array.from(this.nodes.values())
                .filter(node => node.style === 'hip-hop');
            
            const randomMotion = basicMotions[Math.floor(Math.random() * basicMotions.length)];
            this.currentMotion = randomMotion.motion;
            this.currentStyle = randomMotion.style;
        }

        // Interpolate to a new motion
        const nextMotion = await this.interpolateMotion();
        this.currentMotion = nextMotion;
        
        return nextMotion;
    }

    private async interpolateMotion(): Promise<tf.Tensor> {
        if (!this.currentMotion) {
            throw new Error('No current motion available');
        }

        // Get possible transitions
        const possibleEdges = this.edges.get(this.currentStyle) || [];
        
        if (possibleEdges.length === 0) {
            return this.currentMotion;
        }

        // Select a transition based on weights
        const totalWeight = possibleEdges.reduce((sum, edge) => sum + edge.weight, 0);
        let random = Math.random() * totalWeight;
        
        let selectedEdge: MotionEdge | null = null;
        for (const edge of possibleEdges) {
            random -= edge.weight;
            if (random <= 0) {
                selectedEdge = edge;
                break;
            }
        }

        if (!selectedEdge) {
            return this.currentMotion;
        }

        // Apply transition
        const transition = selectedEdge.transition;
        const interpolationFactor = tf.scalar(0.1); // Smooth transition
        
        const interpolatedMotion = tf.add(
            this.currentMotion,
            tf.mul(transition, interpolationFactor)
        );

        // Update current style
        this.currentStyle = selectedEdge.to;
        
        return interpolatedMotion;
    }

    public getCurrentStyle(): string {
        return this.currentStyle;
    }

    public async blendMotions(motions: tf.Tensor[], weights: number[]): Promise<tf.Tensor> {
        if (motions.length !== weights.length) {
            throw new Error('Motions and weights arrays must have the same length');
        }

        // Normalize weights
        const totalWeight = weights.reduce((sum, w) => sum + w, 0);
        const normalizedWeights = weights.map(w => w / totalWeight);

        // Blend motions
        let blendedMotion = tf.zeros(motions[0].shape);
        
        for (let i = 0; i < motions.length; i++) {
            blendedMotion = tf.add(
                blendedMotion,
                tf.mul(motions[i], tf.scalar(normalizedWeights[i]))
            );
        }

        return blendedMotion;
    }

    public async smoothMotion(motion: tf.Tensor, windowSize: number = 5): Promise<tf.Tensor> {
        // Apply simple moving average smoothing
        const kernel = tf.ones([windowSize]).div(windowSize);
        return tf.conv1d(
            motion.expandDims(0),
            kernel.expandDims(0).expandDims(0),
            1,
            'same'
        ).squeeze();
    }
} 