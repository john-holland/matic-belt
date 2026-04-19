import { computeFoodTeleportBecCost, precheckBecFundingForFoodTeleport } from './ger-bec-food-power';
import type { EntangledBECZone } from './ger-bec-ring-toy';

function mockZone(load: bigint, id = 'Z1'): EntangledBECZone<'Gamma'> {
    return {
        id,
        location: 'Earth_Orbit',
        radiation: 'Gamma',
        densityGradient: 0.9,
        vortexSpinRate: 1,
        buffer: { capacity: 10_000_000n, currentLoad: load, decayRate: 0 },
        quantumMetrics: {
            coherenceTime: 1e6,
            entanglementFidelity: 0.9,
            coolingEfficiency: 'Laser_Cooled'
        }
    };
}

describe('computeFoodTeleportBecCost', () => {
    it('increases with separation_m', () => {
        const a = computeFoodTeleportBecCost({
            separation_m: 10,
            tunnelingProbability: 0.5,
            target: 'fruit'
        });
        const b = computeFoodTeleportBecCost({
            separation_m: 20,
            tunnelingProbability: 0.5,
            target: 'fruit'
        });
        expect(b > a).toBe(true);
    });

    it('decreases when tunnelingProbability increases (easier path)', () => {
        const hard = computeFoodTeleportBecCost({
            separation_m: 100,
            tunnelingProbability: 0,
            target: 'fruit'
        });
        const easy = computeFoodTeleportBecCost({
            separation_m: 100,
            tunnelingProbability: 1,
            target: 'fruit'
        });
        expect(hard > easy).toBe(true);
    });

    it('meat target is at least as expensive as fruit for same inputs', () => {
        const fruit = computeFoodTeleportBecCost({
            separation_m: 50,
            tunnelingProbability: 0.4,
            target: 'fruit'
        });
        const meat = computeFoodTeleportBecCost({
            separation_m: 50,
            tunnelingProbability: 0.4,
            target: 'meat'
        });
        expect(meat >= fruit).toBe(true);
    });

    it('stays within safe Number range for discharge', () => {
        const c = computeFoodTeleportBecCost({
            separation_m: 50_000,
            tunnelingProbability: 0,
            target: 'meat'
        });
        expect(c <= BigInt(Number.MAX_SAFE_INTEGER)).toBe(true);
    });
});

describe('precheckBecFundingForFoodTeleport', () => {
    it('returns 404 when zone missing', () => {
        const cost = 100n;
        const r = precheckBecFundingForFoodTeleport('MISSING', undefined, cost);
        expect(r.ok).toBe(false);
        if (!r.ok) {
            expect(r.status).toBe(404);
            expect(r.body.becZoneId).toBe('MISSING');
        }
    });

    it('returns 422 when load below cost', () => {
        const cost = 50_000n;
        const r = precheckBecFundingForFoodTeleport('Z', mockZone(100n), cost);
        expect(r.ok).toBe(false);
        if (!r.ok) {
            expect(r.status).toBe(422);
            expect(r.body.requiredCost).toBe(cost.toString());
            expect(r.body.currentLoad).toBe('100');
        }
    });

    it('succeeds when load covers cost', () => {
        const cost = 1_000n;
        const z = mockZone(10_000n, 'Z');
        const r = precheckBecFundingForFoodTeleport('Z', z, cost);
        expect(r.ok).toBe(true);
        if (r.ok) expect(r.zone.id).toBe('Z');
    });
});
