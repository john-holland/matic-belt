// Custom Vector3 class
class Vector3 {
    x: number;
    y: number;
    z: number;

    constructor(x: number = 0, y: number = 0, z: number = 0) {
        this.x = x;
        this.y = y;
        this.z = z;
    }

    clone(): Vector3 {
        return new Vector3(this.x, this.y, this.z);
    }

    copy(v: Vector3): Vector3 {
        this.x = v.x;
        this.y = v.y;
        this.z = v.z;
        return this;
    }

    add(v: Vector3): Vector3 {
        this.x += v.x;
        this.y += v.y;
        this.z += v.z;
        return this;
    }

    sub(v: Vector3): Vector3 {
        this.x -= v.x;
        this.y -= v.y;
        this.z -= v.z;
        return this;
    }

    multiplyScalar(s: number): Vector3 {
        this.x *= s;
        this.y *= s;
        this.z *= s;
        return this;
    }

    length(): number {
        return Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z);
    }
}

// Wing configuration constants
const WING_CONFIG = {
    ASPECT_RATIO: {
        CONDOR: 8.5,
        DRAGON: 6.2,
        VTOL: 4.8
    },
    FLAP_SECTIONS: 8,
    VENT_SECTIONS: 12,
    MAX_ANGLE: Math.PI / 3, // 60 degrees
    MIN_ANGLE: -Math.PI / 4, // -45 degrees
    VENT_OPENING: 0.3, // 30% of wing chord
    POCKET_DEPTH: 0.15 // 15% of wing chord
};

// Aerodynamic parameters
const AERO_PARAMS = {
    BERNOULLI_COEFFICIENT: 0.5,
    VENTURIEFFECT_RATIO: 1.8,
    LIFT_COEFFICIENT: {
        NORMAL: 1.2,
        VENTED: 1.8,
        POCKETED: 2.1
    },
    DRAG_COEFFICIENT: {
        NORMAL: 0.8,
        VENTED: 0.6,
        POCKETED: 0.9
    }
};

// Mechanical control parameters
const MECHANICAL_CONFIG = {
    SPRING_RATES: {
        FLAP: 5000, // N/m
        VENT: 3000,
        POCKET: 4000
    },
    DAMPING: {
        FLAP: 100, // Ns/m
        VENT: 80,
        POCKET: 120
    },
    MASS_DISTRIBUTION: {
        FLAP: 0.3, // kg/m
        VENT: 0.2,
        POCKET: 0.25
    },
    CENTER_OF_PRESSURE: {
        FLAP: 0.25, // % of chord
        VENT: 0.35,
        POCKET: 0.15
    }
};

interface WingState {
    position: Vector3;
    velocity: Vector3;
    angle: number;
    mode: 'VTOL' | 'CRUISE' | 'HOVER';
    flapStates: number[];
    ventStates: number[];
    pocketStates: number[];
    liftForce: number;
    dragForce: number;
    thrustVector: Vector3;
    mechanicalState: MechanicalState;
    isMechanicalMode: boolean;
}

interface WingSection {
    position: Vector3;
    angle: number;
    flapAngle: number;
    ventOpen: number;
    pocketDepth: number;
    localLift: number;
    localDrag: number;
    mechanicalProperties: {
        springDeflection: number;
        dampingVelocity: number;
        inertialMass: number;
        pressureCenter: number;
    };
}

interface MechanicalState {
    springForces: number[];
    dampingForces: number[];
    inertialForces: number[];
    pressureForces: number[];
    mechanicalLock: boolean;
}

export class WingFirmware {
    private wingState: WingState;
    private sections: WingSection[];
    private targetPosition: Vector3;
    private targetVelocity: Vector3;
    private aspectRatio: number;
    private isVtolMode: boolean;

    constructor() {
        this.wingState = {
            position: new Vector3(),
            velocity: new Vector3(),
            angle: 0,
            mode: 'CRUISE',
            flapStates: new Array(WING_CONFIG.FLAP_SECTIONS).fill(0),
            ventStates: new Array(WING_CONFIG.VENT_SECTIONS).fill(0),
            pocketStates: new Array(WING_CONFIG.FLAP_SECTIONS).fill(0),
            liftForce: 0,
            dragForce: 0,
            thrustVector: new Vector3(),
            mechanicalState: {
                springForces: new Array(WING_CONFIG.FLAP_SECTIONS).fill(0),
                dampingForces: new Array(WING_CONFIG.FLAP_SECTIONS).fill(0),
                inertialForces: new Array(WING_CONFIG.FLAP_SECTIONS).fill(0),
                pressureForces: new Array(WING_CONFIG.FLAP_SECTIONS).fill(0),
                mechanicalLock: false
            },
            isMechanicalMode: false
        };

        this.sections = this.initializeSections();
        this.targetPosition = new Vector3();
        this.targetVelocity = new Vector3();
        this.aspectRatio = WING_CONFIG.ASPECT_RATIO.CONDOR;
        this.isVtolMode = false;
    }

    private initializeSections(): WingSection[] {
        const sections: WingSection[] = [];
        const span = 1.0; // Normalized wing span
        const chord = span / this.aspectRatio;

        for (let i = 0; i < WING_CONFIG.FLAP_SECTIONS; i++) {
            const y = (i / (WING_CONFIG.FLAP_SECTIONS - 1) - 0.5) * span;
            sections.push({
                position: new Vector3(0, y, 0),
                angle: 0,
                flapAngle: 0,
                ventOpen: 0,
                pocketDepth: 0,
                localLift: 0,
                localDrag: 0,
                mechanicalProperties: {
                    springDeflection: 0,
                    dampingVelocity: 0,
                    inertialMass: MECHANICAL_CONFIG.MASS_DISTRIBUTION.FLAP * chord,
                    pressureCenter: chord * MECHANICAL_CONFIG.CENTER_OF_PRESSURE.FLAP
                }
            });
        }

        return sections;
    }

    public updateWingState(deltaTime: number): void {
        if (this.wingState.isMechanicalMode) {
            this.updateMechanicalState(deltaTime);
        } else {
            // Calculate required forces
            const requiredLift = this.calculateRequiredLift();
            const requiredThrust = this.calculateRequiredThrust();

            // Update wing configuration based on mode
            if (this.isVtolMode) {
                this.updateVtolConfiguration(requiredLift, requiredThrust);
            } else {
                this.updateCruiseConfiguration(requiredLift);
            }

            // Update section states
            this.updateSectionStates(deltaTime);
        }

        // Calculate final forces
        this.calculateForces();
    }

    private calculateRequiredLift(): number {
        const gravity = 9.81;
        const mass = 1000; // kg
        const verticalVelocity = this.wingState.velocity.z;
        const targetVerticalVelocity = this.targetVelocity.z;

        // PID-like control for lift
        const error = targetVerticalVelocity - verticalVelocity;
        const lift = mass * gravity + error * 1000; // Basic proportional control

        return Math.max(0, lift);
    }

    private calculateRequiredThrust(): Vector3 {
        const velocityError = this.targetVelocity.clone().sub(this.wingState.velocity);
        const positionError = this.targetPosition.clone().sub(this.wingState.position);

        // Combine position and velocity errors for thrust vector
        return velocityError.add(positionError.multiplyScalar(0.1));
    }

    private updateVtolConfiguration(requiredLift: number, requiredThrust: Vector3): void {
        const verticalComponent = requiredThrust.z;
        const isAscending = verticalComponent > 0;

        // Update aspect ratio for VTOL
        this.aspectRatio = WING_CONFIG.ASPECT_RATIO.VTOL;

        // Configure wing sections based on ascent/descent
        this.sections.forEach((section, index) => {
            if (isAscending) {
                // Vent configuration for ascent
                section.ventOpen = WING_CONFIG.VENT_OPENING;
                section.pocketDepth = 0;
                section.flapAngle = WING_CONFIG.MIN_ANGLE;
            } else {
                // Pocket configuration for descent
                section.ventOpen = 0;
                section.pocketDepth = WING_CONFIG.POCKET_DEPTH;
                section.flapAngle = WING_CONFIG.MAX_ANGLE;
            }
        });
    }

    private updateCruiseConfiguration(requiredLift: number): void {
        // Reset to cruise aspect ratio
        this.aspectRatio = WING_CONFIG.ASPECT_RATIO.CONDOR;

        // Configure sections for efficient cruise
        this.sections.forEach((section, index) => {
            section.ventOpen = 0;
            section.pocketDepth = 0;
            section.flapAngle = 0;
        });
    }

    private updateSectionStates(deltaTime: number): void {
        this.sections.forEach((section, index) => {
            // Update flap angles
            const targetFlapAngle = this.wingState.flapStates[index];
            section.flapAngle += (targetFlapAngle - section.flapAngle) * deltaTime * 5;

            // Update vent states
            const targetVentOpen = this.wingState.ventStates[index];
            section.ventOpen += (targetVentOpen - section.ventOpen) * deltaTime * 3;

            // Update pocket states
            const targetPocketDepth = this.wingState.pocketStates[index];
            section.pocketDepth += (targetPocketDepth - section.pocketDepth) * deltaTime * 2;
        });
    }

    private calculateForces(): void {
        let totalLift = 0;
        let totalDrag = 0;

        this.sections.forEach(section => {
            // Calculate local forces based on section configuration
            const { lift, drag } = this.calculateSectionForces(section);
            section.localLift = lift;
            section.localDrag = drag;

            totalLift += lift;
            totalDrag += drag;
        });

        // Apply Bernoulli effect for vented sections
        if (this.isVtolMode) {
            const ventedSections = this.sections.filter(s => s.ventOpen > 0);
            if (ventedSections.length > 0) {
                const venturiEffect = this.calculateVenturiEffect(ventedSections);
                totalLift *= (1 + venturiEffect);
                totalDrag *= (1 - venturiEffect * 0.5);
            }
        }

        this.wingState.liftForce = totalLift;
        this.wingState.dragForce = totalDrag;
    }

    private calculateSectionForces(section: WingSection): { lift: number; drag: number } {
        const velocity = this.wingState.velocity.length();
        const dynamicPressure = 0.5 * 1.225 * velocity * velocity; // Air density * velocity^2

        // Calculate lift coefficient based on configuration
        let liftCoeff = AERO_PARAMS.LIFT_COEFFICIENT.NORMAL;
        if (section.ventOpen > 0) {
            liftCoeff = AERO_PARAMS.LIFT_COEFFICIENT.VENTED;
        } else if (section.pocketDepth > 0) {
            liftCoeff = AERO_PARAMS.LIFT_COEFFICIENT.POCKETED;
        }

        // Calculate drag coefficient
        let dragCoeff = AERO_PARAMS.DRAG_COEFFICIENT.NORMAL;
        if (section.ventOpen > 0) {
            dragCoeff = AERO_PARAMS.DRAG_COEFFICIENT.VENTED;
        } else if (section.pocketDepth > 0) {
            dragCoeff = AERO_PARAMS.DRAG_COEFFICIENT.POCKETED;
        }

        // Calculate forces
        const lift = liftCoeff * dynamicPressure * Math.cos(section.angle);
        const drag = dragCoeff * dynamicPressure * Math.sin(section.angle);

        return { lift, drag };
    }

    private calculateVenturiEffect(sections: WingSection[]): number {
        const totalVentArea = sections.reduce((sum, s) => sum + s.ventOpen, 0);
        const averageVentArea = totalVentArea / sections.length;

        // Calculate Venturi effect based on vent area and velocity
        const velocity = this.wingState.velocity.length();
        const venturiEffect = AERO_PARAMS.VENTURIEFFECT_RATIO * 
            (averageVentArea * velocity) / (1 + averageVentArea);

        return venturiEffect;
    }

    public setVtolMode(enabled: boolean): void {
        this.isVtolMode = enabled;
        this.wingState.mode = enabled ? 'VTOL' : 'CRUISE';
    }

    public setTargetPosition(position: Vector3): void {
        this.targetPosition.copy(position);
    }

    public setTargetVelocity(velocity: Vector3): void {
        this.targetVelocity.copy(velocity);
    }

    public getWingState(): WingState {
        return { ...this.wingState };
    }

    public getSectionStates(): WingSection[] {
        return this.sections.map(section => ({ ...section }));
    }

    public setMechanicalMode(enabled: boolean): void {
        this.wingState.isMechanicalMode = enabled;
        if (enabled) {
            this.initializeMechanicalState();
        }
    }

    private initializeMechanicalState(): void {
        // Set initial mechanical state based on current conditions
        this.sections.forEach((section, index) => {
            const velocity = this.wingState.velocity.length();
            const dynamicPressure = 0.5 * 1.225 * velocity * velocity;

            // Calculate initial spring forces
            this.wingState.mechanicalState.springForces[index] = 
                MECHANICAL_CONFIG.SPRING_RATES.FLAP * section.mechanicalProperties.springDeflection;

            // Calculate initial damping forces
            this.wingState.mechanicalState.dampingForces[index] = 
                MECHANICAL_CONFIG.DAMPING.FLAP * section.mechanicalProperties.dampingVelocity;

            // Calculate initial pressure forces
            this.wingState.mechanicalState.pressureForces[index] = 
                dynamicPressure * section.mechanicalProperties.pressureCenter;
        });
    }

    private updateMechanicalState(deltaTime: number): void {
        this.sections.forEach((section, index) => {
            // Calculate spring forces
            const springForce = this.calculateSpringForce(section, index);
            
            // Calculate damping forces
            const dampingForce = this.calculateDampingForce(section, index);
            
            // Calculate inertial forces
            const inertialForce = this.calculateInertialForce(section, index);
            
            // Calculate pressure forces
            const pressureForce = this.calculatePressureForce(section, index);

            // Update mechanical state
            this.wingState.mechanicalState.springForces[index] = springForce;
            this.wingState.mechanicalState.dampingForces[index] = dampingForce;
            this.wingState.mechanicalState.inertialForces[index] = inertialForce;
            this.wingState.mechanicalState.pressureForces[index] = pressureForce;

            // Update section state based on mechanical forces
            this.updateSectionFromMechanicalForces(section, index, deltaTime);
        });
    }

    private calculateSpringForce(section: WingSection, index: number): number {
        const deflection = section.flapAngle;
        return MECHANICAL_CONFIG.SPRING_RATES.FLAP * deflection;
    }

    private calculateDampingForce(section: WingSection, index: number): number {
        const velocity = section.mechanicalProperties.dampingVelocity;
        return MECHANICAL_CONFIG.DAMPING.FLAP * velocity;
    }

    private calculateInertialForce(section: WingSection, index: number): number {
        const velocity = this.wingState.velocity.length();
        const acceleration = velocity * 0.1; // Use a fixed time step for mechanical mode
        return section.mechanicalProperties.inertialMass * acceleration;
    }

    private calculatePressureForce(section: WingSection, index: number): number {
        const velocity = this.wingState.velocity.length();
        const dynamicPressure = 0.5 * 1.225 * velocity * velocity;
        return dynamicPressure * section.mechanicalProperties.pressureCenter;
    }

    private updateSectionFromMechanicalForces(
        section: WingSection, 
        index: number, 
        deltaTime: number
    ): void {
        if (!this.wingState.isMechanicalMode) return;

        // Calculate net force
        const netForce = 
            this.wingState.mechanicalState.springForces[index] +
            this.wingState.mechanicalState.dampingForces[index] +
            this.wingState.mechanicalState.inertialForces[index] +
            this.wingState.mechanicalState.pressureForces[index];

        // Update section state based on mechanical forces
        const isAscending = this.wingState.velocity.z > 0;
        
        if (isAscending) {
            // Mechanical vent control
            section.ventOpen = Math.min(
                WING_CONFIG.VENT_OPENING,
                Math.max(0, netForce / MECHANICAL_CONFIG.SPRING_RATES.VENT)
            );
            section.pocketDepth = 0;
        } else {
            // Mechanical pocket control
            section.pocketDepth = Math.min(
                WING_CONFIG.POCKET_DEPTH,
                Math.max(0, -netForce / MECHANICAL_CONFIG.SPRING_RATES.POCKET)
            );
            section.ventOpen = 0;
        }

        // Update flap angle based on mechanical forces
        section.flapAngle += (netForce / MECHANICAL_CONFIG.SPRING_RATES.FLAP) * deltaTime;
        section.flapAngle = Math.max(
            WING_CONFIG.MIN_ANGLE,
            Math.min(WING_CONFIG.MAX_ANGLE, section.flapAngle)
        );
    }
} 