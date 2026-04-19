import { spawnSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { computeFoodTeleportBecCost, precheckBecFundingForFoodTeleport } from './ger-bec-food-power';
import { GerBecRingToyController, type EntangledBECZone } from './ger-bec-ring-toy';
import { QuantumFoodTeleporter } from './quantum-food-teleporter';
import { runQuantumPython } from './quantum-python-runner';

function quantumGeoSidecarAvailable(): boolean {
    const cli = path.join(__dirname, '../../python/quantum_geo/cli.py');
    if (!fs.existsSync(cli)) {
        return false;
    }
    const py = process.env.QUANTUM_PYTHON_BIN || 'python3';
    const payload = JSON.stringify({
        op: 'ecef_llh',
        lat: 40.7,
        lon: -74,
        alt_m: 10,
        body: 'earth'
    });
    const r = spawnSync(py, [cli], {
        input: payload,
        encoding: 'utf-8',
        timeout: 20000
    });
    if (r.error || r.status !== 0 || !r.stdout) {
        return false;
    }
    try {
        const j = JSON.parse(r.stdout) as { ok?: boolean; result?: { ecef_m?: number[] } };
        return j.ok === true && Array.isArray(j.result?.ecef_m) && j.result!.ecef_m!.length === 3;
    } catch {
        return false;
    }
}

const sidecarOk = quantumGeoSidecarAvailable();

function becZone(id: string, currentLoad: bigint): EntangledBECZone<'Gamma'> {
    return {
        id,
        location: 'Earth_Orbit',
        radiation: 'Gamma',
        densityGradient: 0.95,
        vortexSpinRate: 100_000,
        buffer: {
            capacity: 100_000_000n,
            currentLoad,
            decayRate: 0.0001
        },
        quantumMetrics: {
            coherenceTime: 1_000_000,
            entanglementFidelity: 0.92,
            coolingEfficiency: 'Laser_Cooled'
        }
    };
}

(sidecarOk ? describe : describe.skip)('tofu BEC funding orchestration (matches router flow)', () => {
    let asyncProbeOk = false;

    beforeAll(async () => {
        const r = await runQuantumPython<{ ecef_m: number[] }>({
            op: 'ecef_llh',
            lat: 0,
            lon: 0,
            alt_m: 0,
            body: 'earth'
        });
        asyncProbeOk = !!(r.ok && r.result?.ecef_m && r.result.ecef_m.length === 3);
        expect(asyncProbeOk).toBe(true);
    }, 25000);

    it('mirrors router: precheck blocks when load is too low', async () => {
        const food = new QuantumFoodTeleporter();
        const ger = new GerBecRingToyController();
        const id = 'ORCH-422';
        ger.registerZone(becZone(id, 40n));

        const geo = await food.measureAnchoredSeparation({
            gps: { lat: 40.7128, lon: -74.006, alt_m: 10, body: 'earth' },
            laptopBehindOffsetEnu_m: { east_m: -0.05, north_m: 0, up_m: 0 },
            sensorOffsetEnu_m: { east_m: 0.05, north_m: 0, up_m: 0 }
        });
        expect(geo.ok).toBe(true);
        if (!geo.ok) return;

        const cost = computeFoodTeleportBecCost({
            separation_m: geo.separation_m,
            tunnelingProbability: 0.5,
            target: 'fruit'
        });
        const pre = precheckBecFundingForFoodTeleport(id, ger.getZone(id), cost);
        expect(pre.ok).toBe(false);
        if (!pre.ok) expect(pre.status).toBe(422);
    }, 30000);

    it('mirrors router: convert then triggerDischarge debits BEC', async () => {
        const food = new QuantumFoodTeleporter();
        const ger = new GerBecRingToyController();
        const id = 'ORCH-OK';
        const initial = 50_000_000n;
        ger.registerZone(becZone(id, initial));

        const geo = await food.measureAnchoredSeparation({
            gps: { lat: 40.7128, lon: -74.006, alt_m: 10, body: 'earth' },
            laptopBehindOffsetEnu_m: { east_m: -0.05, north_m: 0, up_m: 0 },
            sensorOffsetEnu_m: { east_m: 0.05, north_m: 0, up_m: 0 }
        });
        expect(geo.ok).toBe(true);
        if (!geo.ok) return;

        const tprob = 0.5;
        const cost = computeFoodTeleportBecCost({
            separation_m: geo.separation_m,
            tunnelingProbability: tprob,
            target: 'fruit'
        });
        const pre = precheckBecFundingForFoodTeleport(id, ger.getZone(id), cost);
        expect(pre.ok).toBe(true);

        const out = await food.convertTofuWithAnchors({
            target: 'fruit',
            tofuItem: 'tofu',
            gps: { lat: 40.7128, lon: -74.006, alt_m: 10, body: 'earth' },
            laptopBehindOffsetEnu_m: { east_m: -0.05, north_m: 0, up_m: 0 },
            sensorOffsetEnu_m: { east_m: 0.05, north_m: 0, up_m: 0 },
            tunnelingProbability: tprob,
            precomputedGeometry: {
                separation_m: geo.separation_m,
                laptopEcef_m: geo.laptopEcef_m,
                sensorEcef_m: geo.sensorEcef_m
            }
        });
        expect(out.success).toBe(true);

        await ger.triggerDischarge(id, Number(cost));
        expect(ger.getZone(id)!.buffer.currentLoad).toBe(initial - cost);
    }, 45000);
});
