/**
 * Bullfight Metaphor Engine
 * 
 * Models the arena dynamics of the bullfight metaphor:
 * - Matador position = Earth's steering mechanism
 * - Bull energy = ionospheric/waste energy states
 * - Spectator consciousness = observer effect power
 * - Catharsis/humility = energy transformation
 * - Death/transformation events = quantum state collapse (Bullfighting mode)
 * - Clowns, dodges, falls, recovery (Bull Riding mode)
 * 
 * Two modes:
 * - Bullfighting: Traditional death/transformation focus, explosive energy rearrangement
 * - Bull Riding: No death, clowns as safety mechanisms, human falls and recovery
 */

import { EventEmitter } from 'events';
import { Vector3D } from './bull-bear-topology';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export type BullfightMode = 'bullfighting' | 'bullriding';

export interface MatadorState {
    id: string;
    position: Vector3D;
    energy: number; // Consciousness/control level
    control: number; // Ability to steer Earth
    style: number; // Grace of movement
    lastUpdate: number;
}

export interface BullState {
    id: string;
    position: Vector3D;
    energy: NonLocalEnergy; // Ionosphere/waste energy
    aggression: number; // Wildness of bull
    coherence: number; // How held-together the energy is
    lastUpdate: number;
}

export interface NonLocalEnergy {
    totalEnergy: number;
    coherence: number; // 0-1, how held-together
    dispersion: number; // How spread out
    decayRate: number;
    quantumComponents: QuantumEnergyComponent[];
}

export interface QuantumEnergyComponent {
    position: Vector3D;
    probability: number;
    phase: number;
    entanglement?: string[]; // IDs of entangled components
}

export interface SpectatorState {
    id: string;
    position: Vector3D;
    attention: number; // Focus on the fight
    consciousness: number;
    groupThinkAberration: number; // Radial error from same viewpoint
    emotionalState: 'calm' | 'excited' | 'fearful' | 'cathartic';
    lastUpdate: number;
}

export interface ClownState {
    id: string;
    position: Vector3D;
    bufferStrength: number; // Ability to catch falling observers
    active: boolean;
    rescues: number; // How many times caught someone
    style: 'comic' | 'brave';
    lastUpdate: number;
}

export interface HumanFall {
    id: string;
    observerId: string;
    startPosition: Vector3D;
    currentPosition: Vector3D;
    startTime: number;
    duration: number;
    isCaught: boolean;
    caughtBy?: string; // Clown ID
    recoveryEnergy: number;
}

export interface BullfightEvent {
    id: string;
    type: 'charge' | 'dodge' | 'fall' | 'rescue' | 'death' | 'transformation' | 'recovery' | 'taunt';
    timestamp: number;
    participants: string[];
    energyChange: number;
    metadata?: any;
}

export interface BullfightDynamics {
    mode: BullfightMode;
    arena: ArenaGeometry;
    matador: MatadorState;
    bull: BullState;
    spectators: SpectatorState[];
    clowns: ClownState[];
    activeFalls: HumanFall[];
    recentEvents: BullfightEvent[];
    catharsisLevel: number;
    totalEnergy: number;
    simulationTime: number;
}

export interface ArenaGeometry {
    center: Vector3D;
    radius: number;
    shape: 'circular' | 'rectangular';
    boundaries: { min: Vector3D; max: Vector3D };
    density: number; // Observer density affects energy
}

export interface RodeoScore {
    rideId: string;
    rideTime: number;
    bullEnergy: number;
    stylePoints: number;
    controlPoints: number;
    recoveryPoints: number;
    totalScore: number;
}

// ============================================================================
// MAIN CLASS
// ============================================================================

export class BullfightMetaphorEngine extends EventEmitter {
    private dynamics: BullfightDynamics;
    private mode: BullfightMode;
    private isRunning: boolean = false;
    private updateInterval: NodeJS.Timeout | null = null;

    // Constants
    private readonly CATHARSIS_THRESHOLD = 0.8;
    private readonly EIGHT_SECOND_RULE = 8000; // ms
    private readonly FALL_GRAVITY = 0.1;
    private readonly CLOWN_BUFFER_RADIUS = 100;
    private readonly GROUP_THINK_INFLUENCE = 0.3;

    constructor(mode: BullfightMode = 'bullfighting') {
        super();
        this.mode = mode;
        this.dynamics = this.initializeDynamics();
    }

    /**
     * Initialize bullfight dynamics
     */
    private initializeDynamics(): BullfightDynamics {
        const arena: ArenaGeometry = {
            center: { x: 0, y: 0, z: 0 },
            radius: 1000,
            shape: 'circular',
            boundaries: {
                min: { x: -1000, y: -1000, z: 0 },
                max: { x: 1000, y: 1000, z: 0 }
            },
            density: 0
        };

        const matador: MatadorState = {
            id: 'matador_1',
            position: { x: 0, y: 100, z: 0 },
            energy: 0.7,
            control: 0.6,
            style: 0.5,
            lastUpdate: Date.now()
        };

        const bull: BullState = {
            id: 'bull_1',
            position: { x: 0, y: 0, z: 0 },
            energy: {
                totalEnergy: 1.0,
                coherence: 0.6,
                dispersion: 0.3,
                decayRate: 0.001,
                quantumComponents: []
            },
            aggression: 0.7,
            coherence: 0.6,
            lastUpdate: Date.now()
        };

        return {
            mode: this.mode,
            arena,
            matador,
            bull,
            spectators: [],
            clowns: this.mode === 'bullriding' ? this.initializeClowns() : [],
            activeFalls: [],
            recentEvents: [],
            catharsisLevel: 0.0,
            totalEnergy: 1.0,
            simulationTime: 0
        };
    }

    /**
     * Initialize clowns for bull riding mode
     */
    private initializeClowns(): ClownState[] {
        const clowns: ClownState[] = [];
        const numClowns = 4;
        const angleStep = (Math.PI * 2) / numClowns;

        for (let i = 0; i < numClowns; i++) {
            const angle = i * angleStep;
            clowns.push({
                id: `clown_${i}`,
                position: {
                    x: Math.cos(angle) * this.dynamics.arena.radius * 0.8,
                    y: Math.sin(angle) * this.dynamics.arena.radius * 0.8,
                    z: 0
                },
                bufferStrength: 0.8,
                active: true,
                rescues: 0,
                style: i % 2 === 0 ? 'comic' : 'brave',
                lastUpdate: Date.now()
            });
        }

        return clowns;
    }

    /**
     * Start the simulation
     */
    public start(updateRate: number = 60): void {
        if (this.isRunning) return;

        this.isRunning = true;
        const intervalMs = 1000 / updateRate;

        this.updateInterval = setInterval(() => {
            this.update();
        }, intervalMs);

        console.log(`🐂 Bullfight Metaphor Engine Started (${this.mode} mode)`);
        this.emit('simulationStarted', { timestamp: Date.now(), mode: this.mode });
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

        console.log('🐂 Bullfight Metaphor Engine Stopped');
        this.emit('simulationStopped', { timestamp: Date.now() });
    }

    /**
     * Main update loop
     */
    private update(): void {
        this.dynamics.simulationTime += 1;

        // Update matador
        this.updateMatador();

        // Update bull energy
        this.updateBullEnergy();

        // Update spectators
        this.updateSpectators();

        // Update clowns (bull riding mode)
        if (this.mode === 'bullriding') {
            this.updateClowns();
            this.updateActiveFalls();
        }

        // Check for events
        this.checkForEvents();

        // Update catharsis level
        this.updateCatharsis();

        // Emit update
        this.emit('update', { ...this.dynamics });
    }

    /**
     * Update matador state
     */
    private updateMatador(): void {
        const matador = this.dynamics.matador;

        // Matador's control affects Earth steering
        const controlDecay = 0.001;
        matador.control = Math.max(0, Math.min(1, matador.control - controlDecay));

        // Style affects grace of movement
        const styleVariation = (Math.random() - 0.5) * 0.01;
        matador.style = Math.max(0, Math.min(1, matador.style + styleVariation));

        // Position drifts based on bull energy
        const bullInfluence = this.dynamics.bull.aggression * 0.1;
        matador.position.x += (Math.random() - 0.5) * bullInfluence;
        matador.position.y += (Math.random() - 0.5) * bullInfluence;

        matador.lastUpdate = Date.now();
    }

    /**
     * Update bull energy (non-local quantum states)
     */
    private updateBullEnergy(): void {
        const bull = this.dynamics.bull;

        // Bull energy decays over time
        bull.energy.totalEnergy *= (1 - bull.energy.decayRate);

        // Coherence decreases with time (energy becomes more scattered)
        const coherenceDecay = 0.001 * (1 - bull.energy.coherence);
        bull.energy.coherence = Math.max(0, bull.energy.coherence - coherenceDecay);

        // Dispersion increases as coherence decreases
        bull.energy.dispersion = 1 - bull.energy.coherence;

        // Update quantum components
        for (const component of bull.energy.quantumComponents) {
            component.probability *= (1 - bull.energy.decayRate);
            component.phase += Math.PI * 0.01;
        }

        // Remove dead quantum components
        bull.energy.quantumComponents = bull.energy.quantumComponents.filter(
            c => c.probability > 0.01
        );

        bull.lastUpdate = Date.now();
    }

    /**
     * Update spectators
     */
    private updateSpectators(): void {
        for (const spectator of this.dynamics.spectators) {
            // Group think aberration from same viewpoint
            const groupThinkEffect = this.calculateGroupThinkAberration(spectator.position);
            spectator.groupThinkAberration = groupThinkEffect;

            // Attention fluctuates
            const attentionChange = (Math.random() - 0.5) * 0.02;
            spectator.attention = Math.max(0, Math.min(1, spectator.attention + attentionChange));

            // Emotional state changes based on events
            if (this.dynamics.catharsisLevel > this.CATHARSIS_THRESHOLD) {
                spectator.emotionalState = 'cathartic';
            } else if (spectator.attention > 0.8) {
                spectator.emotionalState = 'excited';
            } else if (this.dynamics.bull.aggression > 0.8) {
                spectator.emotionalState = 'fearful';
            } else {
                spectator.emotionalState = 'calm';
            }

            spectator.lastUpdate = Date.now();
        }
    }

    /**
     * Calculate group think aberration from having same viewpoint
     */
    private calculateGroupThinkAberration(position: Vector3D): number {
        let totalAberration = 0;
        let neighborCount = 0;

        for (const spectator of this.dynamics.spectators) {
            const distance = this.euclideanDistance(position, spectator.position);
            if (distance < 100 && distance > 0) {
                // Radial error increases with proximity (same view = stronger group think)
                const radialError = this.GROUP_THINK_INFLUENCE / (1 + distance / 50);
                totalAberration += radialError;
                neighborCount++;
            }
        }

        return neighborCount > 0 ? totalAberration / neighborCount : 0;
    }

    /**
     * Update clowns (bull riding mode only)
     */
    private updateClowns(): void {
        for (const clown of this.dynamics.clowns) {
            if (!clown.active) continue;

            // Clowns move to buffer zones where falls are likely
            const nearestFall = this.findNearestFall(clown.position);
            if (nearestFall && !nearestFall.isCaught) {
                const distance = this.euclideanDistance(clown.position, nearestFall.currentPosition);
                if (distance < this.CLOWN_BUFFER_RADIUS) {
                    // Attempt rescue
                    const rescueChance = clown.bufferStrength * (1 - distance / this.CLOWN_BUFFER_RADIUS);
                    if (Math.random() < rescueChance) {
                        this.rescueObserver(nearestFall, clown.id);
                    }
                }
            }

            clown.lastUpdate = Date.now();
        }
    }

    /**
     * Update active human falls
     */
    private updateActiveFalls(): void {
        const now = Date.now();

        for (const fall of this.dynamics.activeFalls) {
            fall.duration = now - fall.startTime;

            // Falls continue until caught or max duration
            if (!fall.isCaught && fall.duration < this.EIGHT_SECOND_RULE * 10) {
                // Gravity effect
                fall.currentPosition.y -= this.FALL_GRAVITY;
                fall.currentPosition.x += (Math.random() - 0.5) * 0.5;
                fall.currentPosition.z += (Math.random() - 0.5) * 0.5;

                // Recovery energy builds up
                fall.recoveryEnergy = Math.min(1, fall.recoveryEnergy + 0.01);
            }

            // Remove old fallen observers
            if (fall.duration > this.EIGHT_SECOND_RULE * 20) {
                this.removeFall(fall.id);
            }
        }
    }

    /**
     * Check for bullfight events
     */
    private checkForEvents(): void {
        const matador = this.dynamics.matador;
        const bull = this.dynamics.bull;

        // Charge event (bull attacks)
        if (Math.random() < bull.aggression * 0.1) {
            this.triggerEvent('charge', [matador.id, bull.id], -bull.aggression * 0.1);
        }

        // Dodge event (matador evades)
        if (bull.aggression > 0.6 && matador.control > 0.5) {
            const dodgeChance = matador.control * matador.style * 0.1;
            if (Math.random() < dodgeChance) {
                this.triggerEvent('dodge', [matador.id], matador.style * 0.2);
            }
        }

        // In bull riding mode: falls, rescues, recovery
        if (this.mode === 'bullriding') {
            this.checkForFalls();
            this.checkForRecovery();
        }

        // In bullfighting mode: death/transformation
        if (this.mode === 'bullfighting') {
            this.checkForDeath();
        }
    }

    /**
     * Check for human falls (bull riding mode)
     */
    private checkForFalls(): void {
        // Random chance a spectator loses grip on reality
        for (const spectator of this.dynamics.spectators) {
            if (this.dynamics.bull.aggression > 0.7 && Math.random() < 0.01) {
                this.triggerFall(spectator.id, spectator.position);
            }
        }
    }

    /**
     * Check for recovery (bull riding mode)
     */
    private checkForRecovery(): void {
        for (const fall of this.dynamics.activeFalls) {
            if (!fall.isCaught && fall.recoveryEnergy > 0.8) {
                this.triggerEvent('recovery', [fall.observerId], fall.recoveryEnergy * 0.3);
                this.removeFall(fall.id);
            }
        }
    }

    /**
     * Check for death/transformation (bullfighting mode)
     */
    private checkForDeath(): void {
        const matador = this.dynamics.matador;
        const bull = this.dynamics.bull;

        // Death occurs when bull energy is fully released and matador control is low
        if (bull.energy.totalEnergy < 0.1 && matador.control < 0.2) {
            this.triggerEvent('death', ['bull'], bull.energy.totalEnergy);
            this.triggerEvent('transformation', [matador.id], this.dynamics.catharsisLevel);
            
            // Reset bull energy
            bull.energy.totalEnergy = 1.0;
            bull.energy.coherence = 0.6;
            bull.aggression = 0.7;
        }
    }

    /**
     * Update catharsis level
     */
    private updateCatharsis(): void {
        const totalSpectatorAttention = this.dynamics.spectators.reduce(
            (sum, s) => sum + s.attention, 0
        );
        const avgAttention = totalSpectatorAttention / Math.max(1, this.dynamics.spectators.length);

        // Catharsis builds from attention and events
        const catharsisIncrease = avgAttention * 0.001;
        this.dynamics.catharsisLevel = Math.min(1, this.dynamics.catharsisLevel + catharsisIncrease);

        // Catharsis decays slowly
        this.dynamics.catharsisLevel *= 0.9995;
    }

    /**
     * Trigger a bullfight event
     */
    private triggerEvent(
        type: BullfightEvent['type'],
        participants: string[],
        energyChange: number
    ): void {
        const event: BullfightEvent = {
            id: `event_${Date.now()}`,
            type,
            timestamp: Date.now(),
            participants,
            energyChange,
            metadata: {
                mode: this.mode,
                simulationTime: this.dynamics.simulationTime
            }
        };

        this.dynamics.recentEvents.push(event);

        // Keep only recent events
        if (this.dynamics.recentEvents.length > 100) {
            this.dynamics.recentEvents.shift();
        }

        this.dynamics.totalEnergy += energyChange;
        this.emit('event', event);
    }

    /**
     * Trigger a human fall (bull riding mode)
     */
    private triggerFall(observerId: string, position: Vector3D): void {
        const fall: HumanFall = {
            id: `fall_${Date.now()}`,
            observerId,
            startPosition: { ...position },
            currentPosition: { ...position },
            startTime: Date.now(),
            duration: 0,
            isCaught: false,
            recoveryEnergy: 0.2
        };

        this.dynamics.activeFalls.push(fall);
        this.triggerEvent('fall', [observerId], -0.1);

        this.emit('fallStarted', { id: fall.id, observerId, position });
    }

    /**
     * Rescue an observer
     */
    private rescueObserver(fall: HumanFall, clownId: string): void {
        fall.isCaught = true;
        fall.caughtBy = clownId;

        const clown = this.dynamics.clowns.find(c => c.id === clownId);
        if (clown) {
            clown.rescues++;
        }

        this.triggerEvent('rescue', [fall.observerId, clownId], fall.recoveryEnergy * 0.5);
        this.removeFall(fall.id);

        this.emit('observerRescued', { fallId: fall.id, clownId });
    }

    /**
     * Remove a fall
     */
    private removeFall(fallId: string): void {
        const index = this.dynamics.activeFalls.findIndex(f => f.id === fallId);
        if (index >= 0) {
            this.dynamics.activeFalls.splice(index, 1);
        }
    }

    /**
     * Find nearest fall to a position
     */
    private findNearestFall(position: Vector3D): HumanFall | null {
        let nearest: HumanFall | null = null;
        let minDistance = Infinity;

        for (const fall of this.dynamics.activeFalls) {
            const distance = this.euclideanDistance(position, fall.currentPosition);
            if (distance < minDistance) {
                minDistance = distance;
                nearest = fall;
            }
        }

        return nearest;
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

    // ========================================================================
    // PUBLIC API
    // ========================================================================

    /**
     * Get current dynamics state
     */
    public getState(): BullfightDynamics {
        return { ...this.dynamics };
    }

    /**
     * Add a spectator
     */
    public addSpectator(id: string, position: Vector3D, consciousness: number): void {
        const spectator: SpectatorState = {
            id,
            position,
            attention: 0.5,
            consciousness,
            groupThinkAberration: 0,
            emotionalState: 'calm',
            lastUpdate: Date.now()
        };

        this.dynamics.spectators.push(spectator);
        this.emit('spectatorAdded', { id, position, consciousness });
    }

    /**
     * Boost matador energy
     */
    public boostMatador(amount: number): void {
        this.dynamics.matador.energy = Math.min(1, this.dynamics.matador.energy + amount);
        this.dynamics.matador.control = Math.min(1, this.dynamics.matador.control + amount * 0.5);
        this.emit('matadorBoosted', { amount, newEnergy: this.dynamics.matador.energy });
    }

    /**
     * Boost bull aggression
     */
    public boostBull(amount: number): void {
        this.dynamics.bull.aggression = Math.min(1, this.dynamics.bull.aggression + amount);
        this.dynamics.bull.energy.totalEnergy = Math.min(1, this.dynamics.bull.energy.totalEnergy + amount);
        this.emit('bullBoosted', { amount, newAggression: this.dynamics.bull.aggression });
    }

    /**
     * Set mode
     */
    public setMode(mode: BullfightMode): void {
        this.mode = mode;
        this.dynamics.mode = mode;
        
        if (mode === 'bullriding' && this.dynamics.clowns.length === 0) {
            this.dynamics.clowns = this.initializeClowns();
        } else if (mode === 'bullfighting') {
            this.dynamics.clowns = [];
        }

        this.emit('modeChanged', { mode });
    }
}

export default BullfightMetaphorEngine;



