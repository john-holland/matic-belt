/**
 * Bull-Bear Cosmic Topology Simulator
 * 
 * Models Earth's position in space through the metaphorical lens of a bullfight:
 * - Spain (bear/humanity/production) eating Bull (waste/ionosphere)
 * - Matador's arena as conscious center manifold
 * - Observer consciousness warping spacetime through gravitational lensing
 * - Slip streams (Chutes and Ladders) for navigation through reality currents
 * - Safe superposition zones for Earth 1-N
 * 
 * Two modes:
 * - Bullfighting: Traditional death/transformation focus
 * - Bull Riding: No death, clowns as safety, human falls and recovery
 */

import { EventEmitter } from 'events';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export type SimulationMode = 'bullfighting' | 'bullriding';

export interface Vector3D {
    x: number;
    y: number;
    z: number;
}

export interface GeoShape {
    id: string;
    name: string;
    coordinates: Vector3D[];
    centroid: Vector3D;
    metadata?: any;
}

export interface CorkscrewPath {
    helixAxis: Vector3D;
    radius: number;
    pitch: number;
    velocity: Vector3D;
    currentPosition: Vector3D;
    timestamp: number;
}

export interface ObserverState {
    id: string;
    position: Vector3D;
    attentionFocus: Vector3D;
    consciousnessLevel: number;
    observationPower: number; // How much their attention affects spacetime
    isBloodshot: boolean; // Intensely focused
    lastUpdate: number;
}

export interface StabilityPoint {
    id: string;
    position: Vector3D;
    stability: number;
    stabilityRadius: number;
    earthCount: number; // How many Earths can occupy this point
    accessible: boolean;
}

export interface ToroidalField {
    center: Vector3D;
    majorRadius: number;
    minorRadius: number;
    strength: number;
    direction: Vector3D;
    harmonics: number[];
}

export interface GravitationalLensing {
    id: string;
    sourcePosition: Vector3D;
    observerConsciousness: number;
    compressionFactor: number; // Non-Euclidean compression
    lensingStrength: number; // Spacetime curvature
    affectedRegions: SpaceTimeRegion[];
    lastUpdate: number;
}

export interface SpaceTimeRegion {
    bounds: { min: Vector3D; max: Vector3D };
    distortion: number; // How warped spacetime is here
}

export interface SlipStream {
    id: string;
    path: Vector3D[];
    velocity: number;
    observerDensity: number;
    compressionGradient: number;
    entryPoints: Vector3D[];
    exitPoints: Vector3D[];
    type: 'chute' | 'ladder'; // Fast path or elevation
    lastUpdate: number;
}

export interface SuperpositionZone {
    id: string;
    earthIndex: number; // Which Earth (1-N)
    position: Vector3D;
    stabilityScore: number;
    consciousnessField: number;
    accessibleViaSlipStream: boolean;
    lensingFactor: number;
    scale: 'universe' | 'galaxy' | 'solar' | 'planet' | 'city' | 'building' | 'apartment';
    metadata?: any;
}

export interface BullBearTopology {
    spainGeometry: GeoShape | null;
    earthTrajectory: CorkscrewPath;
    observerEyes: ObserverState[];
    safeZones: SuperpositionZone[];
    consciousnessField: ToroidalField;
    lagrangianPoints: StabilityPoint[];
    gravitationalLensing: GravitationalLensing[];
    slipStreams: SlipStream[];
    mode: SimulationMode;
    simulationTime: number;
}

export interface BullBearTopologyConfig {
    mode?: SimulationMode;
    spainGeometry?: GeoShape;
    earthVelocity?: Vector3D;
    maxObservers?: number;
    updateRate?: number;
}

// ============================================================================
// MAIN SIMULATOR CLASS
// ============================================================================

export class BullBearTopologySimulator extends EventEmitter {
    private topology: BullBearTopology;
    private config: Required<BullBearTopologyConfig>;
    private isRunning: boolean = false;
    private updateInterval: NodeJS.Timeout | null = null;

    // Constants
    private readonly EARTH_ORBITAL_SPEED = 67000; // mph
    private readonly SOLAR_SYSTEM_SPEED = 448000; // mph through galaxy
    private readonly GALACTIC_MOTION_SCALE = 0.01;
    private readonly CONSCIOUSNESS_EFFECT_SCALE = 0.001;
    private readonly SLIP_STREAM_THRESHOLD = 0.7;

    constructor(config?: BullBearTopologyConfig) {
        super();

        this.config = {
            mode: config?.mode || 'bullfighting',
            spainGeometry: config?.spainGeometry || this.initializeSpainGeometry(),
            earthVelocity: config?.earthVelocity || { x: 0, y: 0, z: 0 },
            maxObservers: config?.maxObservers || 100,
            updateRate: config?.updateRate || 60
        };

        this.topology = {
            spainGeometry: this.config.spainGeometry,
            earthTrajectory: this.initializeEarthTrajectory(),
            observerEyes: [],
            safeZones: [],
            consciousnessField: this.initializeConsciousnessField(),
            lagrangianPoints: [],
            gravitationalLensing: [],
            slipStreams: [],
            mode: this.config.mode,
            simulationTime: 0
        };

        this.initializeLagrangianPoints();
    }

    /**
     * Initialize Spain's geography as "bear eating bull"
     */
    private initializeSpainGeometry(): GeoShape {
        // Simplified Spain outline (bear eating bull shape)
        // In production, this would load actual geographic coordinates
        const coordinates: Vector3D[] = [
            { x: -9, y: 42, z: 0 },
            { x: -8, y: 43, z: 0 },
            { x: -3, y: 43, z: 0 },
            { x: 2, y: 42, z: 0 },
            { x: 3, y: 40, z: 0 },
            { x: 3, y: 38, z: 0 },
            { x: -2, y: 36, z: 0 },
            { x: -7, y: 36, z: 0 },
            { x: -9, y: 40, z: 0 }
        ];

        const centroid = this.calculateCentroid(coordinates);

        return {
            id: 'spain',
            name: 'Spain (Bear Eating Bull)',
            coordinates,
            centroid,
            metadata: {
                description: 'Geographic shape representing humanity (bear) consuming waste/ionosphere (bull)',
                scale: 'planetary'
            }
        };
    }

    /**
     * Initialize Earth's corkscrew trajectory through space
     */
    private initializeEarthTrajectory(): CorkscrewPath {
        // Earth moves in a corkscrew: orbital around Sun + solar system motion through galaxy
        return {
            helixAxis: { x: 1, y: 0, z: 0 },
            radius: 93e6, // miles (Earth-Sun distance)
            pitch: 584e6, // miles per revolution (year)
            velocity: {
                x: this.SOLAR_SYSTEM_SPEED * this.GALACTIC_MOTION_SCALE,
                y: 0,
                z: this.EARTH_ORBITAL_SPEED * this.GALACTIC_MOTION_SCALE
            },
            currentPosition: { x: 0, y: 0, z: 0 },
            timestamp: Date.now()
        };
    }

    /**
     * Initialize consciousness field as toroidal shape
     */
    private initializeConsciousnessField(): ToroidalField {
        return {
            center: this.topology?.earthTrajectory?.currentPosition || { x: 0, y: 0, z: 0 },
            majorRadius: 1e8, // Large radius for consciousness field
            minorRadius: 1e6,
            strength: 1.0,
            direction: { x: 1, y: 0, z: 0 },
            harmonics: [1, 2, 3, 5, 8] // Fibonacci-like resonance pattern
        };
    }

    /**
     * Initialize Lagrangian points as safe zones
     */
    private initializeLagrangianPoints(): void {
        const trajectory = this.topology.earthTrajectory;
        const lagrangianPoints: StabilityPoint[] = [];

        // L1-L5 Lagrangian points for Earth-Sun system
        for (let i = 1; i <= 5; i++) {
            const angle = (i - 1) * (Math.PI * 2 / 5);
            const distance = trajectory.radius * (1 + i * 0.1);
            
            lagrangianPoints.push({
                id: `L${i}`,
                position: {
                    x: Math.cos(angle) * distance,
                    y: Math.sin(angle) * distance,
                    z: 0
                },
                stability: 0.8 - (i * 0.1),
                stabilityRadius: distance * 0.1,
                earthCount: 1,
                accessible: true
            });
        }

        this.topology.lagrangianPoints = lagrangianPoints;
    }

    /**
     * Start the simulation
     */
    public start(): void {
        if (this.isRunning) return;

        this.isRunning = true;
        const intervalMs = 1000 / this.config.updateRate;

        this.updateInterval = setInterval(() => {
            this.update();
        }, intervalMs);

        console.log(`🐻🐂 Bull-Bear Topology Simulator Started (${this.config.mode} mode)`);
        this.emit('simulationStarted', { timestamp: Date.now(), mode: this.config.mode });
    }

    /**
     * Stop the simulation
     */
    public stop(): void {
        if (!this.isRunning) return;

        this.isRunning = false;
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
        }

        console.log('🐻🐂 Bull-Bear Topology Simulator Stopped');
        this.emit('simulationStopped', { timestamp: Date.now() });
    }

    /**
     * Main simulation update loop
     */
    private update(): void {
        this.topology.simulationTime += 1;

        // Update Earth's corkscrew trajectory
        this.updateEarthTrajectory();

        // Update observers and their effects
        this.updateObservers();

        // Calculate gravitational lensing from conscious observation
        this.calculateGravitationalLensing();

        // Detect slip streams (reality currents)
        this.detectSlipStreams();

        // Update safe superposition zones
        this.updateSafeZones();

        // Emit update event
        this.emit('update', { ...this.topology });
    }

    /**
     * Update Earth's corkscrew trajectory through space
     */
    private updateEarthTrajectory(): void {
        const t = this.topology.simulationTime * this.config.updateRate;
        const trajectory = this.topology.earthTrajectory;

        // Helical motion: orbit around Sun + solar system motion
        const theta = (t * 0.1) % (Math.PI * 2);
        const zOffset = (t * 0.1 * trajectory.pitch / (2 * Math.PI));

        trajectory.currentPosition = {
            x: Math.cos(theta) * trajectory.radius + zOffset * trajectory.helixAxis.x,
            y: Math.sin(theta) * trajectory.radius + zOffset * trajectory.helixAxis.y,
            z: zOffset + Math.sin(theta * 2) * trajectory.radius * 0.1 // Slight wobble
        };

        trajectory.timestamp = Date.now();
    }

    /**
     * Update observer states and their consciousness effects
     */
    private updateObservers(): void {
        // Update existing observers
        for (const observer of this.topology.observerEyes) {
            observer.observationPower = observer.consciousnessLevel * 
                                       this.CONSCIOUSNESS_EFFECT_SCALE;
            
            // Bloodshot observers have higher power
            if (observer.isBloodshot) {
                observer.observationPower *= 1.5;
            }
            
            observer.lastUpdate = Date.now();
        }
    }

    /**
     * Calculate gravitational lensing from conscious observation
     */
    private calculateGravitationalLensing(): void {
        this.topology.gravitationalLensing = [];

        for (const observer of this.topology.observerEyes) {
            const totalConsciousness = this.topology.observerEyes.reduce(
                (sum, o) => sum + o.consciousnessLevel, 0
            );
            const avgConsciousness = totalConsciousness / this.topology.observerEyes.length;

            // Consciousness concentration creates spacetime warping
            const lensingStrength = observer.observationPower * avgConsciousness;
            
            if (lensingStrength > 0.1) {
                const lensing: GravitationalLensing = {
                    id: `lens_${observer.id}`,
                    sourcePosition: observer.position,
                    observerConsciousness: observer.consciousnessLevel,
                    compressionFactor: 1 / (1 + lensingStrength * 10), // Non-Euclidean compression
                    lensingStrength: lensingStrength,
                    affectedRegions: this.calculateAffectedRegions(observer.position, lensingStrength),
                    lastUpdate: Date.now()
                };

                this.topology.gravitationalLensing.push(lensing);
            }
        }
    }

    /**
     * Calculate affected spacetime regions around lensing source
     */
    private calculateAffectedRegions(center: Vector3D, strength: number): SpaceTimeRegion[] {
        const regions: SpaceTimeRegion[] = [];
        const radius = 1e6 * strength * 100;

        regions.push({
            bounds: {
                min: { x: center.x - radius, y: center.y - radius, z: center.z - radius },
                max: { x: center.x + radius, y: center.y + radius, z: center.z + radius }
            },
            distortion: strength
        });

        return regions;
    }

    /**
     * Detect slip streams (reality currents) where non-Euclidean compression creates shortcuts
     */
    private detectSlipStreams(): void {
        this.topology.slipStreams = [];

        // Find regions of high compression gradient
        for (const lens of this.topology.gravitationalLensing) {
            if (lens.compressionFactor < this.SLIP_STREAM_THRESHOLD) {
                // High compression creates a potential slip stream
                const stream = this.createSlipStream(lens);
                if (stream) {
                    this.topology.slipStreams.push(stream);
                }
            }
        }

        // Also check Lagrangian points as potential slip stream nodes
        for (const lagrangian of this.topology.lagrangianPoints) {
            if (lagrangian.stability > 0.6) {
                const observerDensity = this.calculateObserverDensity(lagrangian.position);
                
                if (observerDensity > 0.5) {
                    const stream = this.createSlipStreamFromPoint(lagrangian, observerDensity);
                    this.topology.slipStreams.push(stream);
                }
            }
        }
    }

    /**
     * Create a slip stream from gravitational lensing
     */
    private createSlipStream(lensing: GravitationalLensing): SlipStream | null {
        const entryPoint = { ...lensing.sourcePosition };
        
        // Create exit point in direction of highest consciousness gradient
        const maxObserver = this.topology.observerEyes.reduce((max, o) => 
            o.consciousnessLevel > (max?.consciousnessLevel || 0) ? o : max,
            this.topology.observerEyes[0]
        );

        if (!maxObserver) return null;

        const exitPoint = { ...maxObserver.position };

        // Interpolate path
        const steps = 20;
        const path: Vector3D[] = [];
        for (let i = 0; i <= steps; i++) {
            const t = i / steps;
            path.push({
                x: entryPoint.x + (exitPoint.x - entryPoint.x) * t,
                y: entryPoint.y + (exitPoint.y - entryPoint.y) * t,
                z: entryPoint.z + (exitPoint.z - entryPoint.z) * t
            });
        }

        // Determine if it's a chute (fast path) or ladder (elevation)
        const consciousnessDiff = maxObserver.consciousnessLevel - lensing.observerConsciousness;
        const type: 'chute' | 'ladder' = consciousnessDiff > 0 ? 'ladder' : 'chute';

        return {
            id: `stream_${lensing.id}`,
            path,
            velocity: Math.abs(lensing.compressionFactor - 1) * 1000,
            observerDensity: lensing.observerConsciousness,
            compressionGradient: Math.abs(1 - lensing.compressionFactor),
            entryPoints: [entryPoint],
            exitPoints: [exitPoint],
            type,
            lastUpdate: Date.now()
        };
    }

    /**
     * Create slip stream from Lagrangian point
     */
    private createSlipStreamFromPoint(point: StabilityPoint, observerDensity: number): SlipStream {
        const path: Vector3D[] = [point.position];
        
        // Connect to nearest Earth trajectory point
        const nearestOnTrajectory = this.findNearestTrajectoryPoint(point.position);
        path.push(nearestOnTrajectory);

        return {
            id: `stream_${point.id}`,
            path,
            velocity: point.stability * 500,
            observerDensity,
            compressionGradient: 1 - point.stability,
            entryPoints: [point.position],
            exitPoints: [nearestOnTrajectory],
            type: 'ladder',
            lastUpdate: Date.now()
        };
    }

    /**
     * Calculate observer density at a given position
     */
    private calculateObserverDensity(position: Vector3D): number {
        if (this.topology.observerEyes.length === 0) return 0;

        let totalProximity = 0;
        for (const observer of this.topology.observerEyes) {
            const distance = this.euclideanDistance(observer.position, position);
            totalProximity += 1 / (1 + distance / 1e7); // Inverse distance weighted
        }

        return totalProximity / this.topology.observerEyes.length;
    }

    /**
     * Update safe superposition zones for Earth 1-N
     */
    private updateSafeZones(): void {
        this.topology.safeZones = [];

        // Generate zones at Lagrangian points
        for (let earthIndex = 1; earthIndex <= 5; earthIndex++) {
            const lagrangian = this.topology.lagrangianPoints[earthIndex - 1];
            
            const zone: SuperpositionZone = {
                id: `earth_${earthIndex}`,
                earthIndex,
                position: lagrangian.position,
                stabilityScore: lagrangian.stability,
                consciousnessField: this.calculateConsciousnessAtPoint(lagrangian.position),
                accessibleViaSlipStream: this.isAccessibleViaSlipStream(lagrangian.position),
                lensingFactor: this.calculateLensingFactor(lagrangian.position),
                scale: 'solar',
                metadata: {
                    type: 'lagrangian',
                    accessibility: 'stable'
                }
            };

            this.topology.safeZones.push(zone);
        }

        // Sort by stability
        this.topology.safeZones.sort((a, b) => b.stabilityScore - a.stabilityScore);
    }

    /**
     * Calculate consciousness field strength at a point
     */
    private calculateConsciousnessAtPoint(position: Vector3D): number {
        const field = this.topology.consciousnessField;
        const distance = this.euclideanDistance(position, field.center);
        
        // Toroidal field calculation
        const planarDistance = Math.sqrt(
            Math.pow(position.x - field.center.x, 2) + 
            Math.pow(position.y - field.center.y, 2)
        );
        
        const distanceFromTorus = Math.abs(planarDistance - field.majorRadius);
        const toroidalInfluence = Math.exp(-distanceFromTorus / field.minorRadius) * field.strength;
        
        return Math.max(0, Math.min(1, toroidalInfluence));
    }

    /**
     * Check if a point is accessible via slip stream
     */
    private isAccessibleViaSlipStream(position: Vector3D): boolean {
        for (const stream of this.topology.slipStreams) {
            for (const exit of stream.exitPoints) {
                const distance = this.euclideanDistance(position, exit);
                if (distance < 1e6) {
                    return true;
                }
            }
        }
        return false;
    }

    /**
     * Calculate lensing factor at a point
     */
    private calculateLensingFactor(position: Vector3D): number {
        let maxLensing = 0;
        for (const lens of this.topology.gravitationalLensing) {
            const distance = this.euclideanDistance(position, lens.sourcePosition);
            const influence = lens.lensingStrength * Math.exp(-distance / 1e7);
            maxLensing = Math.max(maxLensing, influence);
        }
        return maxLensing;
    }

    /**
     * Helper: Euclidean distance
     */
    private euclideanDistance(p1: Vector3D, p2: Vector3D): number {
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const dz = p2.z - p1.z;
        return Math.sqrt(dx * dx + dy * dy + dz * dz);
    }

    /**
     * Helper: Calculate centroid of points
     */
    private calculateCentroid(points: Vector3D[]): Vector3D {
        const sum = points.reduce((acc, p) => ({
            x: acc.x + p.x,
            y: acc.y + p.y,
            z: acc.z + p.z
        }), { x: 0, y: 0, z: 0 });

        const count = points.length;
        return {
            x: sum.x / count,
            y: sum.y / count,
            z: sum.z / count
        };
    }

    /**
     * Helper: Find nearest point on Earth trajectory
     */
    private findNearestTrajectoryPoint(position: Vector3D): Vector3D {
        // For now, just return current position
        // TODO: implement proper path finding
        return { ...this.topology.earthTrajectory.currentPosition };
    }

    // ========================================================================
    // PUBLIC API
    // ========================================================================

    /**
     * Get current topology state
     */
    public getState(): BullBearTopology {
        return { ...this.topology };
    }

    /**
     * Add an observer
     */
    public addObserver(id: string, position: Vector3D, consciousnessLevel: number, isBloodshot: boolean = false): void {
        if (this.topology.observerEyes.length >= this.config.maxObservers) {
            console.warn('Maximum observer count reached');
            return;
        }

        const observer: ObserverState = {
            id,
            position,
            attentionFocus: position,
            consciousnessLevel: Math.max(0, Math.min(1, consciousnessLevel)),
            observationPower: 0,
            isBloodshot,
            lastUpdate: Date.now()
        };

        this.topology.observerEyes.push(observer);
        this.emit('observerAdded', { id, position, consciousnessLevel });
    }

    /**
     * Remove an observer
     */
    public removeObserver(id: string): void {
        const index = this.topology.observerEyes.findIndex(o => o.id === id);
        if (index >= 0) {
            this.topology.observerEyes.splice(index, 1);
            this.emit('observerRemoved', { id });
        }
    }

    /**
     * Update observer attention focus
     */
    public updateObserverFocus(id: string, focus: Vector3D): void {
        const observer = this.topology.observerEyes.find(o => o.id === id);
        if (observer) {
            observer.attentionFocus = focus;
            observer.lastUpdate = Date.now();
        }
    }

    /**
     * Set simulation mode
     */
    public setMode(mode: SimulationMode): void {
        this.topology.mode = mode;
        this.config.mode = mode;
        this.emit('modeChanged', { mode });
    }
}

export default BullBearTopologySimulator;

