import { spawnSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { QuantumFoodTeleporter } from './quantum-food-teleporter';
import { runQuantumPython } from './quantum-python-runner';
import {
    EARTH_AMBIENT_RADIATION_SIM_uSv_PER_H,
    HEALTHY_SIM_TOTAL_MAX_U_SV_H,
    NEVER_DANGEROUS_SIM_TOTAL_MAX_U_SV_H,
    transmutationRadiationBudget_uSvH
} from './transmutation-radiation-budget';

/** Sync probe so the suite can `describe.skip` without async describe (see `npm run verify:quantum-python`). */
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

describe('transmutationRadiationBudget_uSvH (simulation caps)', () => {
    it('keeps stressed inputs under NEVER_DANGEROUS policy', () => {
        const b = transmutationRadiationBudget_uSvH({
            ambientRadiation_uSv_h: 20,
            separation_m: 0.04,
            tunnelingProbability: 1
        });
        expect(b.total_uSv_h).toBeLessThanOrEqual(NEVER_DANGEROUS_SIM_TOTAL_MAX_U_SV_H);
        expect(b.ambient_uSv_h).toBe(20);
        expect(b.process_uSv_h).toBeGreaterThan(0);
    });

    it('uses Earth ambient default when omitted', () => {
        const b = transmutationRadiationBudget_uSvH({
            separation_m: 1,
            tunnelingProbability: 0
        });
        expect(b.ambient_uSv_h).toBe(EARTH_AMBIENT_RADIATION_SIM_uSv_PER_H);
    });
});

(sidecarOk ? describe : describe.skip)('anchored transmutation radiation integration', () => {
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

    const tightOffsets = {
        laptopBehindOffsetEnu_m: { east_m: -0.05, north_m: 0, up_m: 0 },
        sensorOffsetEnu_m: { east_m: 0.05, north_m: 0, up_m: 0 }
    };
    const looseOffsets = {
        laptopBehindOffsetEnu_m: { east_m: -2, north_m: 0, up_m: 0 },
        sensorOffsetEnu_m: { east_m: 2, north_m: 0, up_m: 0 }
    };

    const gpsCases = [
        { lat: 40.7128, lon: -74.006, alt_m: 10, body: 'earth' as const },
        { lat: -4.5, lon: 137.4, alt_m: -1000, body: 'mars' as const }
    ];

    for (const gps of gpsCases) {
        for (const tprob of [0, 0.5, 1] as const) {
            for (const offsets of [tightOffsets, looseOffsets]) {
                it(`healthy band: ${gps.body} tprob=${tprob} ${offsets === tightOffsets ? 'tight' : 'loose'}`, async () => {
                    const teleporter = new QuantumFoodTeleporter();
                    const out = await teleporter.convertTofuWithAnchors({
                        target: 'meat',
                        tofuItem: 'tofu',
                        gps: { ...gps },
                        ...offsets,
                        tunnelingProbability: tprob
                    });
                    expect(out.radiationBudget).toBeDefined();
                    expect(out.radiationBudget!.total_uSv_h).toBeLessThanOrEqual(HEALTHY_SIM_TOTAL_MAX_U_SV_H);
                }, 30000);
            }
        }
    }

    it('stressed ambient + max tunneling + tight geometry stays under NEVER_DANGEROUS', async () => {
        const teleporter = new QuantumFoodTeleporter();
        const out = await teleporter.convertTofuWithAnchors({
            target: 'fruit',
            tofuItem: 'tofu',
            gps: { lat: 51.5, lon: -0.12, alt_m: 5, body: 'earth' },
            ...tightOffsets,
            tunnelingProbability: 1,
            ambientRadiation_uSv_h: 5
        });
        expect(out.radiationBudget).toBeDefined();
        expect(out.radiationBudget!.total_uSv_h).toBeLessThanOrEqual(NEVER_DANGEROUS_SIM_TOTAL_MAX_U_SV_H);
    }, 30000);
});
