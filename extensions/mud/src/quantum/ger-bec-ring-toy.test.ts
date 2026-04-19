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
});
