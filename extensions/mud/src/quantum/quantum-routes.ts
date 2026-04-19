import express, { Request, Response, Router } from 'express';
import type OpenAI from 'openai';
import { QuantumZoneService } from './quantum-zone-service';
import type { CreateQuantumZoneBody, TransmutationVolume } from './quantum-zone-types';
import { HouseholdCounterSpectra } from './household-counter-spectra';
import { SpectrographicAnalyzer } from './spectrographic-analyzer';
import { TunnelingFieldApi } from './tunneling-field-api';
import { SoilTrader, type SoilTradeConfig } from './soil-trading';
import { QuantumFoodTeleporter } from './quantum-food-teleporter';
import { listStableElementSymbols, STABLE_ELEMENT_ONE_MOLE_G } from './stable-element-table';
import { runQuantumPython } from './quantum-python-runner';

export interface QuantumRouterDeps {
    openai: OpenAI | null;
}

function devOverrideOk(req: Request): boolean {
    return req.query.devOverride === '1' && process.env.QUANTUM_DEV_OVERRIDE === '1';
}

export function createQuantumRouter(deps: QuantumRouterDeps): Router {
    const router = express.Router();

    const zoneService = new QuantumZoneService(deps.openai);
    const spectro = new SpectrographicAnalyzer();
    const counterSpectra = new HouseholdCounterSpectra(spectro);
    const tunnelingApi = new TunnelingFieldApi();
    const soilTrader = new SoilTrader();
    const foodTeleporter = new QuantumFoodTeleporter();

    router.get('/python-status', async (_req: Request, res: Response) => {
        const ping = await runQuantumPython<{ ecef_m: number[] }>({
            op: 'ecef_llh',
            lat: 0,
            lon: 0,
            alt_m: 0,
            body: 'earth'
        });
        res.json({
            pythonOk: ping.ok,
            error: ping.error,
            hint: 'Set QUANTUM_PYTHON_BIN and install extensions/mud/python/quantum_geo/requirements.txt'
        });
    });

    router.get('/elements/stable', (_req: Request, res: Response) => {
        const symbols = listStableElementSymbols();
        const oneMoleGrams = symbols.map((s) => ({
            symbol: s,
            oneMoleMass_g: STABLE_ELEMENT_ONE_MOLE_G[s]
        }));
        res.json({
            simulation: true,
            count: symbols.length,
            elements: oneMoleGrams
        });
    });

    router.post('/zones', async (req: Request, res: Response) => {
        try {
            const body = req.body as CreateQuantumZoneBody;
            if (!body?.name || !body.gps || !body.galacticPosition || !body.cameraData) {
                res.status(400).json({ error: 'name, gps, galacticPosition, cameraData required' });
                return;
            }
            const zone = await zoneService.createZone(body);
            res.status(201).json({ simulation: true, zone });
        } catch (e: any) {
            res.status(500).json({ error: e?.message || 'zone create failed' });
        }
    });

    router.get('/zones/:id', (req: Request, res: Response) => {
        const z = zoneService.getZone(req.params.id);
        if (!z) {
            res.status(404).json({ error: 'zone not found' });
            return;
        }
        res.json({ simulation: true, zone: z });
    });

    router.patch('/zones/:id', async (req: Request, res: Response) => {
        const z = await zoneService.patchZone(req.params.id, req.body || {});
        if (!z) {
            res.status(404).json({ error: 'zone not found' });
            return;
        }
        res.json({ simulation: true, zone: z });
    });

    router.post('/zones/:id/transmutation', async (req: Request, res: Response) => {
        const vol = req.body as Omit<TransmutationVolume, 'id'> & { id?: string };
        if (!vol?.localMin_m || !vol?.localMax_m || !vol?.allowedOperations?.length) {
            res.status(400).json({ error: 'localMin_m, localMax_m, allowedOperations required' });
            return;
        }
        const out = await zoneService.addTransmutationVolume(req.params.id, {
            ...vol,
            anchorRelativeToZoneCenter: vol.anchorRelativeToZoneCenter ?? true,
            shieldingModel: vol.shieldingModel || 'standard_dampeners',
            maxPower: vol.maxPower ?? 100,
            minStability: vol.minStability ?? 0.7
        });
        if (!out.ok) {
            res.status(out.status).json({ error: out.message, simulation: true });
            return;
        }
        res.status(201).json({ simulation: true, volume: out.volume });
    });

    router.post('/materials/counter-spectrum', async (req: Request, res: Response) => {
        try {
            const { spectrum, inventoryMaterials } = req.body || {};
            if (!spectrum?.elements) {
                res.status(400).json({ error: 'spectrum.elements required' });
                return;
            }
            const r = await counterSpectra.recommend({ spectrum, inventoryMaterials });
            res.json({
                simulation: true,
                galacticPosition: req.body?.galacticPosition,
                gps: req.body?.gps,
                ...r
            });
        } catch (e: any) {
            res.status(500).json({ error: e?.message || 'counter-spectrum failed' });
        }
    });

    router.post('/tunneling/volume', async (req: Request, res: Response) => {
        const { zoneId, ...rest } = req.body || {};
        if (zoneId && !devOverrideOk(req)) {
            const g = zoneService.assertFieldStabilized(zoneId);
            if (!g.ok) {
                res.status(422).json({ error: g.message, simulation: true });
                return;
            }
        }
        const t = await tunnelingApi.summarizeVolume({
            lat: Number(rest.lat),
            lon: Number(rest.lon),
            alt_m: Number(rest.alt_m),
            body: rest.body || 'earth',
            planetRadius_m: rest.planetRadius_m,
            surfacePressure_Pa: Number(rest.surfacePressure_Pa ?? 101325),
            temperature_K: Number(rest.temperature_K ?? 288.15),
            gravity_m_s2: rest.gravity_m_s2,
            barrierHeight_eV: Number(rest.barrierHeight_eV ?? 2),
            particleEnergy_eV: Number(rest.particleEnergy_eV ?? 1.5),
            fieldUniformity: Number(rest.fieldUniformity ?? 0.85),
            halfExtentEnu_m: rest.halfExtentEnu_m || { east_m: 10, north_m: 10, up_m: 5 }
        });
        if (!t) {
            res.status(502).json({ error: 'tunneling python sidecar failed', simulation: true });
            return;
        }
        res.json({ simulation: true, zoneId: zoneId || null, summary: t });
    });

    router.post('/soil/tunnel-enrich', async (req: Request, res: Response) => {
        const { zoneId, soilTrade, tunneling, tunnelingProbability } = req.body || {};
        if (!soilTrade?.source?.composition || !soilTrade?.target?.desired) {
            res.status(400).json({ error: 'soilTrade with source.composition and target.desired required' });
            return;
        }
        if (zoneId && !devOverrideOk(req)) {
            const g = zoneService.assertFieldStabilized(zoneId);
            if (!g.ok) {
                res.status(422).json({ error: g.message, simulation: true });
                return;
            }
        }

        let tprob = typeof tunnelingProbability === 'number' ? tunnelingProbability : 0.5;
        if (tunneling?.lat != null) {
            const vol = await tunnelingApi.summarizeVolume({
                lat: Number(tunneling.lat),
                lon: Number(tunneling.lon),
                alt_m: Number(tunneling.alt_m),
                body: tunneling.body || 'earth',
                planetRadius_m: tunneling.planetRadius_m,
                surfacePressure_Pa: Number(tunneling.surfacePressure_Pa ?? 101325),
                temperature_K: Number(tunneling.temperature_K ?? 288.15),
                gravity_m_s2: tunneling.gravity_m_s2,
                barrierHeight_eV: Number(tunneling.barrierHeight_eV ?? 2),
                particleEnergy_eV: Number(tunneling.particleEnergy_eV ?? 1.5),
                fieldUniformity: Number(tunneling.fieldUniformity ?? 0.85),
                halfExtentEnu_m: tunneling.halfExtentEnu_m || { east_m: 5, north_m: 5, up_m: 2 }
            });
            if (vol) tprob = vol.tunnelingProbability;
        }

        soilTrader.setTradeConfig(soilTrade as SoilTradeConfig);
        const analysis = await soilTrader.analyzeSoil(soilTrade as SoilTradeConfig);

        const n = soilTrade.source.composition.nutrients;
        const d = soilTrade.target.desired.nutrients || { nitrogen: n.nitrogen, phosphorus: n.phosphorus, potassium: n.potassium };
        const deltaPy = await runQuantumPython<{ deltaNPK: number[]; quantumFieldAdjustment: number }>({
            op: 'nutrient_delta',
            currentNPK: [n.nitrogen, n.phosphorus, n.potassium],
            desiredNPK: [
                d.nitrogen ?? n.nitrogen,
                d.phosphorus ?? n.phosphorus,
                d.potassium ?? n.potassium
            ],
            tunnelingProbability: tprob
        });

        res.json({
            simulation: true,
            zoneId: zoneId || null,
            tunnelingProbability: tprob,
            nutrientDelta: deltaPy.ok ? deltaPy.result : null,
            soilAnalysis: { nmrCount: analysis.nmrData.length, cells: analysis.cells.length },
            pythonError: deltaPy.ok ? undefined : deltaPy.error
        });
    });

    router.post('/food/tofu-transmute', async (req: Request, res: Response) => {
        const {
            zoneId,
            target,
            tofuItem,
            gps,
            laptopBehindOffsetEnu_m,
            sensorOffsetEnu_m,
            tunnelingProbability,
            ambientRadiation_uSv_h
        } = req.body || {};
        if (!target || !['fruit', 'meat'].includes(target)) {
            res.status(400).json({ error: 'target must be fruit|meat' });
            return;
        }
        if (!gps?.lat && gps?.lat !== 0) {
            res.status(400).json({ error: 'gps with lat,lon,alt_m,body required' });
            return;
        }
        if (zoneId && !devOverrideOk(req)) {
            const g = zoneService.assertFieldStabilized(zoneId);
            if (!g.ok) {
                res.status(422).json({ error: g.message, simulation: true });
                return;
            }
        }

        const laptopBehind = laptopBehindOffsetEnu_m || { east_m: -0.35, north_m: 0, up_m: 0 };
        const sensor = sensorOffsetEnu_m || { east_m: 0.1, north_m: 0.2, up_m: 0.05 };

        const out = await foodTeleporter.convertTofuWithAnchors({
            target,
            tofuItem: tofuItem || 'tofu',
            gps: {
                lat: Number(gps.lat),
                lon: Number(gps.lon),
                alt_m: Number(gps.alt_m ?? 0),
                body: gps.body || 'earth',
                planetRadius_m: gps.planetRadius_m
            },
            laptopBehindOffsetEnu_m: laptopBehind,
            sensorOffsetEnu_m: sensor,
            dishElementalMassFraction: req.body.dishElementalMassFraction,
            tunnelingProbability,
            ambientRadiation_uSv_h:
                ambientRadiation_uSv_h === undefined || ambientRadiation_uSv_h === null
                    ? undefined
                    : Number(ambientRadiation_uSv_h)
        });

        res.json({
            simulation: true,
            zoneId: zoneId || null,
            ...out
        });
    });

    return router;
}
