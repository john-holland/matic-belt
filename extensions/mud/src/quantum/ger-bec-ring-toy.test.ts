import {
    GerBecRingToyController,
    exampleEarthGammaBecZone,
    type EntangledBECZone
} from './ger-bec-ring-toy';

function gammaZone(
    id: string,
    overrides: Partial<EntangledBECZone<'Gamma'>> = {}
): EntangledBECZone<'Gamma'> {
    return {
        id,
        location: 'Quasar_Proximity',
        radiation: 'Gamma',
        densityGradient: 0.95,
        vortexSpinRate: 100_000,
        buffer: {
            capacity: 10_000n,
            currentLoad: 5_000n,
            decayRate: 0.0001
        },
        quantumMetrics: {
            coherenceTime: 1e6,
            entanglementFidelity: 0.92,
            coolingEfficiency: 'Laser_Cooled'
        },
        ringOrientation: { eclipticNormalTilt_deg: 90 },
        ...overrides
    };
}

describe('GerBecRingToyController', () => {
    it('registers example Earth capacitor', () => {
        const c = new GerBecRingToyController();
        c.registerZone(exampleEarthGammaBecZone);
        expect(c.getZone('TERRA-CAP-01')).toBeDefined();
    });

    it('establishes entanglement for matching Gamma zones with good fidelity', () => {
        const c = new GerBecRingToyController();
        const a = gammaZone('A');
        const b = gammaZone('B', { location: 'Earth_Orbit' });
        c.registerZone(a);
        c.registerZone(b);
        expect(c.establishEntanglementLink(a, b)).toBe(true);
        expect(c.getEntanglementPeer('A')).toBe('B');
    });

    it('discharge reduces currentLoad', async () => {
        const c = new GerBecRingToyController();
        const z = gammaZone('Z');
        c.registerZone(z);
        await c.triggerDischarge('Z', 1000);
        expect(c.getZone('Z')!.buffer.currentLoad).toBe(4000n);
        expect(c.getLoopState('Z')).toBe('Discharging');
    });

    it('thermal equilibrium reduces load via decay', () => {
        const c = new GerBecRingToyController();
        c.registerZone(gammaZone('T', { buffer: { capacity: 100n, currentLoad: 100n, decayRate: 0.01 } }));
        c.manageThermalEquilibrium('T');
        expect(c.getZone('T')!.buffer.currentLoad < 100n).toBe(true);
    });

    it('does not vent when fill is below critical failsafe threshold', () => {
        const c = new GerBecRingToyController();
        const z = gammaZone('V', {
            buffer: { capacity: 1000n, currentLoad: 800n, decayRate: 0 },
            failSafe: { ventingTrajectory: [0, 1, 0], criticalContainmentThreshold: 0.92 }
        });
        c.registerZone(z);
        const mech = c.getFailSafeMechanism('V')!;
        const r = mech.emergencyVent();
        expect(r.isVenting).toBe(false);
        expect(r.remainingEnergy).toBe(800n);
        expect(r.exhaustLuminosity).toBe(0);
    });

    it('vents when fill is at or above critical failsafe threshold', () => {
        const c = new GerBecRingToyController();
        const z = gammaZone('W', {
            buffer: { capacity: 1000n, currentLoad: 950n, decayRate: 0 },
            failSafe: { ventingTrajectory: [0, 1, 0], criticalContainmentThreshold: 0.92 }
        });
        c.registerZone(z);
        const r = c.getFailSafeMechanism('W')!.emergencyVent();
        expect(r.isVenting).toBe(true);
        expect(r.remainingEnergy).toBeLessThan(950n);
        expect(r.exhaustLuminosity).toBeGreaterThan(0);
        expect(Number(c.getZone('W')!.buffer.currentLoad)).toBe(Number(r.remainingEnergy));
    });

    it('returns null mechanism when zone has no failsafe', () => {
        const c = new GerBecRingToyController();
        c.registerZone(gammaZone('N'));
        expect(c.getFailSafeMechanism('N')).toBeNull();
    });

    it('runs ensure vent after discharge if still past threshold', async () => {
        const c = new GerBecRingToyController();
        c.registerZone(
            gammaZone('D', {
                buffer: { capacity: 1000n, currentLoad: 950n, decayRate: 0 },
                failSafe: { ventingTrajectory: [0, 1, 0], criticalContainmentThreshold: 0.5 }
            })
        );
        await c.triggerDischarge('D', 10);
        // 940n still above 0.5 threshold → vent down to ~38% capacity (380n).
        expect(c.getZone('D')!.buffer.currentLoad).toBe(380n);
    });
});
