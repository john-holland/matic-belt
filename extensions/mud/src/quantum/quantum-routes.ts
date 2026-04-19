import express, { Request, Response, Router } from 'express';
import type OpenAI from 'openai';
import { QuantumZoneService } from './quantum-zone-service';
import type { CreateQuantumZoneBody, TransmutationVolume } from './quantum-zone-types';
import { HouseholdCounterSpectra } from './household-counter-spectra';
import { SpectrographicAnalyzer } from './spectrographic-analyzer';
import type { SpectrographicData } from './spectrographic-analyzer';
import { TunnelingFieldApi } from './tunneling-field-api';
import { SoilTrader, type SoilTradeConfig } from './soil-trading';
import { QuantumFoodTeleporter } from './quantum-food-teleporter';
import { listStableElementSymbols, STABLE_ELEMENT_ONE_MOLE_G } from './stable-element-table';
import { runQuantumPython } from './quantum-python-runner';
import { SpectroRunSheetStore } from './spectro-run-sheet-store';
import { SpectralWatchdog } from './spectral-watchdog';
import { startSpectralWatchdogCronIfEnabled } from './spectral-watchdog-cron';
import { computeQetGammaBudget, type QetTransferRequest } from './qet-gamma-toy';
import {
    createGerBecRingToyController,
    parseZoneFromBody,
    zoneToJsonSafe,
    type EntangledBECZone
} from './ger-bec-ring-toy';

export interface QuantumRouterDeps {
    openai: OpenAI | null;
}

export interface QuantumRouterLifecycle {
    startSpectralWatchdogCron: () => void;
    stopSpectralWatchdogCron: () => void;
}

export interface QuantumRouterBundle {
    router: Router;
    lifecycle: QuantumRouterLifecycle;
}

function devOverrideOk(req: Request): boolean {
    return req.query.devOverride === '1' && process.env.QUANTUM_DEV_OVERRIDE === '1';
}

export function createQuantumRouter(deps: QuantumRouterDeps): QuantumRouterBundle {
    const router = express.Router();

    const zoneService = new QuantumZoneService(deps.openai);
    const spectro = new SpectrographicAnalyzer();
    const counterSpectra = new HouseholdCounterSpectra(spectro);
    const tunnelingApi = new TunnelingFieldApi();
    const soilTrader = new SoilTrader();
    const foodTeleporter = new QuantumFoodTeleporter();
    const gerBec = createGerBecRingToyController();

    const spectralStore = new SpectroRunSheetStore();
    spectralStore.loadTailFromDisk(2000);
    const spectralWatchdog = new SpectralWatchdog(spectro, spectralStore, zoneService);

    let spectralCronStop: (() => void) | null = null;

    const lifecycle: QuantumRouterLifecycle = {
        startSpectralWatchdogCron: () => {
            if (spectralCronStop) return;
            const { stop } = startSpectralWatchdogCronIfEnabled(spectralWatchdog);
            spectralCronStop = stop;
        },
        stopSpectralWatchdogCron: () => {
            spectralCronStop?.();
            spectralCronStop = null;
        }
    };

    function teleportGate(req: Request, zoneId?: string | null): { ok: true } | { ok: false; message: string } {
        if (devOverrideOk(req)) return { ok: true };
        return zoneService.assertTeleportationAllowed(zoneId ?? undefined);
    }

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
        res.json({
            simulation: true,
            zone: z,
            teleportHold: zoneService.getZoneTeleportationHold(req.params.id),
            globalTeleportHold: zoneService.getGlobalTeleportationHold()
        });
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
        const tg = teleportGate(req, zoneId || undefined);
        if (!tg.ok) {
            res.status(403).json({ error: tg.message, simulation: true });
            return;
        }
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
        const tg = teleportGate(req, zoneId || undefined);
        if (!tg.ok) {
            res.status(403).json({ error: tg.message, simulation: true });
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
        const tg = teleportGate(req, zoneId || undefined);
        if (!tg.ok) {
            res.status(403).json({ error: tg.message, simulation: true });
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

    router.post('/spectral/run', async (req: Request, res: Response) => {
        try {
            const { sectorId, spectrum, miningBaseline, zoneId } = req.body || {};
            if (!sectorId || typeof sectorId !== 'string') {
                res.status(400).json({ error: 'sectorId required' });
                return;
            }
            if (!spectrum?.elements || spectrum.timestamp == null) {
                res.status(400).json({ error: 'spectrum with timestamp, elements, intensity, wavelength required' });
                return;
            }
            const data: SpectrographicData = {
                timestamp: Number(spectrum.timestamp),
                wavelength: Number(spectrum.wavelength ?? 500),
                intensity: Number(spectrum.intensity ?? 0),
                elements: spectrum.elements,
                anomalies: spectrum.anomalies || [],
                intensitySeries: spectrum.intensitySeries,
                miningTag: spectrum.miningTag
            };
            const sheet = await spectralWatchdog.recordAndEvaluateRun({
                sectorId,
                data,
                miningBaseline,
                zoneId: zoneId ? String(zoneId) : undefined,
                cron: false
            });
            res.status(201).json({ simulation: true, sheet });
        } catch (e: any) {
            res.status(500).json({ error: e?.message || 'spectral run failed' });
        }
    });

    router.get('/spectral/runs', (req: Request, res: Response) => {
        const sectorId = String(req.query.sectorId || '');
        if (!sectorId) {
            res.status(400).json({ error: 'sectorId query required' });
            return;
        }
        const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
        const runs = spectralWatchdog.listRecentRuns(sectorId, limit);
        res.json({ simulation: true, sectorId, runs });
    });

    router.get('/spectral/watchdog-status', (_req: Request, res: Response) => {
        res.json({
            simulation: true,
            globalTeleportHold: zoneService.getGlobalTeleportationHold(),
            runsStorePath: spectralStore.getFilePath(),
            lastCronBySector: spectralWatchdog.listLastCronResults()
        });
    });

    router.post('/spectral/hold/global', (req: Request, res: Response) => {
        const { active, reason } = req.body || {};
        if (typeof active !== 'boolean') {
            res.status(400).json({ error: 'active boolean required' });
            return;
        }
        zoneService.setGlobalTeleportationHold(active, reason ? String(reason) : undefined);
        res.json({ simulation: true, globalTeleportHold: zoneService.getGlobalTeleportationHold() });
    });

    router.post('/spectral/hold/zone/:id', (req: Request, res: Response) => {
        const { active, reason } = req.body || {};
        if (typeof active !== 'boolean') {
            res.status(400).json({ error: 'active boolean required' });
            return;
        }
        const id = req.params.id;
        if (!zoneService.getZone(id)) {
            res.status(404).json({ error: 'zone not found' });
            return;
        }
        zoneService.setZoneTeleportationHold(id, active, reason ? String(reason) : undefined);
        res.json({ simulation: true, zoneId: id, teleportHold: zoneService.getZoneTeleportationHold(id) });
    });

    function parseQetBody(body: unknown): QetTransferRequest | null {
        const b = body as Record<string, unknown>;
        if (!b?.observer || !b?.compactObject) return null;
        const obs = b.observer as Record<string, unknown>;
        const co = b.compactObject as Record<string, unknown>;
        if (obs.lat == null || obs.lon == null || obs.alt_m == null || !obs.body) return null;
        if (!co.kind || co.massSolar == null || co.distanceLy == null) return null;
        return {
            observer: {
                lat: Number(obs.lat),
                lon: Number(obs.lon),
                alt_m: Number(obs.alt_m),
                body: (obs.body as 'earth' | 'mars' | 'custom') || 'earth',
                unixTime_s: obs.unixTime_s != null ? Number(obs.unixTime_s) : undefined
            },
            compactObject: {
                kind: co.kind as QetTransferRequest['compactObject']['kind'],
                massSolar: Number(co.massSolar),
                distanceLy: Number(co.distanceLy),
                ra_deg: co.ra_deg != null ? Number(co.ra_deg) : undefined,
                dec_deg: co.dec_deg != null ? Number(co.dec_deg) : undefined,
                redshift_z: co.redshift_z != null ? Number(co.redshift_z) : undefined
            },
            powerDemand_W_SIM: Number(b.powerDemand_W_SIM ?? 0),
            fieldRadius_m: Number(b.fieldRadius_m ?? 1e6),
            qetEfficiencyHint: b.qetEfficiencyHint != null ? Number(b.qetEfficiencyHint) : undefined
        };
    }

    router.post('/qet/gamma-budget', (req: Request, res: Response) => {
        const parsed = parseQetBody(req.body);
        if (!parsed) {
            res.status(400).json({
                error: 'observer (lat,lon,alt_m,body), compactObject (kind,massSolar,distanceLy), powerDemand_W_SIM, fieldRadius_m required'
            });
            return;
        }
        const result = computeQetGammaBudget(parsed, { narrativeYamma: false });
        res.json({ simulation: true, gammaBudget: result });
    });

    router.post('/qet/gamma-transfer', (req: Request, res: Response) => {
        const parsed = parseQetBody(req.body);
        if (!parsed) {
            res.status(400).json({
                error: 'observer (lat,lon,alt_m,body), compactObject (kind,massSolar,distanceLy), powerDemand_W_SIM, fieldRadius_m required'
            });
            return;
        }
        const label = req.body?.label === 'yamma' ? 'yamma' : undefined;
        const result = computeQetGammaBudget(parsed, { narrativeYamma: label === 'yamma' });
        res.json({
            simulation: true,
            label: label ?? 'gamma',
            gammaBudget: result
        });
    });

    /** GER: Galactic Energy Relay — entangled BEC ring toy (simulation only). */
    router.post('/ger/bec/register', (req: Request, res: Response) => {
        const z = parseZoneFromBody((req.body || {}) as Record<string, unknown>);
        if (!z) {
            res.status(400).json({
                error:
                    'id, location, radiation (Gamma|X-Ray), densityGradient, vortexSpinRate, buffer.capacity, buffer.currentLoad, buffer.decayRate, quantumMetrics required'
            });
            return;
        }
        gerBec.registerZone(z as EntangledBECZone);
        res.status(201).json({
            simulation: true,
            protocol: 'GER_0.1a',
            zone: zoneToJsonSafe(z),
            loopState: gerBec.getLoopState(z.id)
        });
    });

    router.get('/ger/bec/zones', (_req: Request, res: Response) => {
        const zones = gerBec.listZones().map((z) => ({
            ...zoneToJsonSafe(z),
            loopState: gerBec.getLoopState(z.id),
            entangledPeerId: gerBec.getEntanglementPeer(z.id) ?? null
        }));
        res.json({ simulation: true, protocol: 'GER_0.1a', zones });
    });

    router.post('/ger/bec/entangle', (req: Request, res: Response) => {
        const { localId, remoteId } = (req.body || {}) as Record<string, unknown>;
        if (!localId || !remoteId) {
            res.status(400).json({ error: 'localId and remoteId required' });
            return;
        }
        const local = gerBec.getZone(String(localId));
        const remote = gerBec.getZone(String(remoteId));
        if (!local || !remote) {
            res.status(404).json({ error: 'one or both zones not registered' });
            return;
        }
        const ok = gerBec.establishEntanglementLink(local, remote);
        res.json({
            simulation: true,
            protocol: 'GER_0.1a',
            linked: ok,
            localId: String(localId),
            remoteId: String(remoteId)
        });
    });

    router.post('/ger/bec/discharge', async (req: Request, res: Response) => {
        const { zoneId, targetOutput } = (req.body || {}) as Record<string, unknown>;
        if (!zoneId || targetOutput == null) {
            res.status(400).json({ error: 'zoneId and targetOutput required' });
            return;
        }
        if (!gerBec.getZone(String(zoneId))) {
            res.status(404).json({ error: 'zone not found' });
            return;
        }
        await gerBec.triggerDischarge(String(zoneId), Number(targetOutput));
        const z = gerBec.getZone(String(zoneId))!;
        res.json({
            simulation: true,
            protocol: 'GER_0.1a',
            zone: zoneToJsonSafe(z),
            loopState: gerBec.getLoopState(String(zoneId))
        });
    });

    router.post('/ger/bec/thermal', (req: Request, res: Response) => {
        const { zoneId } = (req.body || {}) as Record<string, unknown>;
        if (!zoneId) {
            res.status(400).json({ error: 'zoneId required' });
            return;
        }
        if (!gerBec.getZone(String(zoneId))) {
            res.status(404).json({ error: 'zone not found' });
            return;
        }
        gerBec.manageThermalEquilibrium(String(zoneId));
        const z = gerBec.getZone(String(zoneId))!;
        res.json({
            simulation: true,
            protocol: 'GER_0.1a',
            zone: zoneToJsonSafe(z),
            loopState: gerBec.getLoopState(String(zoneId))
        });
    });

    return { router, lifecycle };
}
