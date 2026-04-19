import { StabilityZoneAnalyzer } from './stability-zone-analyzer';
import type { CreateQuantumZoneBody, QuantumZoneRecord, TransmutationVolume } from './quantum-zone-types';
import { ZoneLlmAdvisor } from './zone-llm-advisor';
import { runQuantumPython } from './quantum-python-runner';
import type OpenAI from 'openai';

/** Default `fieldStabilization` when omitted on create (explicit enable required for gated ops). */
export const DEFAULT_FIELD_STABILIZATION = false;

export class QuantumZoneService {
    private readonly analyzer = new StabilityZoneAnalyzer();
    private readonly zones = new Map<string, QuantumZoneRecord>();
    private readonly llm: ZoneLlmAdvisor;

    constructor(openai: OpenAI | null) {
        this.llm = new ZoneLlmAdvisor(openai);
    }

    async createZone(body: CreateQuantumZoneBody): Promise<QuantumZoneRecord> {
        let cameraData = { ...body.cameraData };
        let customMaterials = [...(body.customMaterials || [])];
        let llmNotes: string | undefined;

        if (body.useLlmForCamera && body.cameraData.imageDescription) {
            const advice = await this.llm.adviseFromImageDescription(body.cameraData.imageDescription);
            if (advice) {
                if (advice.enrichedImageDescription) {
                    cameraData = { ...cameraData, imageDescription: advice.enrichedImageDescription };
                }
                customMaterials = [...new Set([...customMaterials, ...advice.detectedMaterials])];
                llmNotes = `${advice.rationale} Risk:${advice.transmutationRisk.toFixed(2)}`;
            }
        }

        const inner = await this.analyzer.createStabilityZone(
            body.name,
            body.environmentalData || {},
            cameraData,
            customMaterials
        );

        const record: QuantumZoneRecord = {
            id: inner.id,
            name: inner.name,
            fieldStabilization: body.fieldStabilization ?? DEFAULT_FIELD_STABILIZATION,
            galacticPosition: body.galacticPosition,
            gps: body.gps,
            safetyRadius_m: body.safetyRadius_m,
            environmentalData: inner.environmentalData,
            cameraData: inner.cameraData,
            stabilityScore: inner.stabilityScore,
            transmutationVolumes: [],
            proximityEntities: body.proximityEntities || [],
            lastUpdated: Date.now(),
            llmNotes
        };

        this.zones.set(record.id, record);
        return record;
    }

    getZone(id: string): QuantumZoneRecord | null {
        return this.zones.get(id) || null;
    }

    async patchZone(
        id: string,
        patch: Partial<
            Pick<
                QuantumZoneRecord,
                | 'fieldStabilization'
                | 'gps'
                | 'galacticPosition'
                | 'safetyRadius_m'
                | 'proximityEntities'
                | 'cameraData'
                | 'environmentalData'
            >
        >
    ): Promise<QuantumZoneRecord | null> {
        const z = this.zones.get(id);
        if (!z) return null;
        const next: QuantumZoneRecord = {
            ...z,
            ...patch,
            lastUpdated: Date.now()
        };
        if (patch.environmentalData || patch.cameraData) {
            const updated = await this.analyzer.updateStabilityZone(id, {
                environmentalData: patch.environmentalData ?? z.environmentalData,
                cameraData: patch.cameraData ?? z.cameraData
            });
            if (updated) {
                next.environmentalData = updated.environmentalData;
                next.cameraData = updated.cameraData;
                next.stabilityScore = updated.stabilityScore;
            }
        }
        this.zones.set(id, next);
        return next;
    }

    assertFieldStabilized(zoneId: string): { ok: true; zone: QuantumZoneRecord } | { ok: false; message: string } {
        const z = this.zones.get(zoneId);
        if (!z) return { ok: false, message: 'zone not found' };
        if (!z.fieldStabilization) {
            return {
                ok: false,
                message: 'fieldStabilization is false for this zone; enable stabilization before transmutation or tunneling operations'
            };
        }
        return { ok: true, zone: z };
    }

    async addTransmutationVolume(
        zoneId: string,
        vol: Omit<TransmutationVolume, 'id'> & { id?: string }
    ): Promise<{ ok: true; volume: TransmutationVolume } | { ok: false; status: number; message: string }> {
        const gate = this.assertFieldStabilized(zoneId);
        if (!gate.ok) {
            return { ok: false, status: 422, message: gate.message };
        }
        const zone = gate.zone;
        const id = vol.id || `tx_${Date.now()}`;
        const volume: TransmutationVolume = { ...vol, id };

        const R = zone.safetyRadius_m ?? 300;
        const up = Math.max(R * 0.5, 50);
        const parentBox = await runQuantumPython<{
            aabbMinEcef_m: number[];
            aabbMaxEcef_m: number[];
        }>({
            op: 'ecef_box_from_local',
            lat: zone.gps.lat,
            lon: zone.gps.lon,
            alt_m: zone.gps.alt_m,
            body: zone.gps.body,
            planetRadius_m: zone.gps.planetRadius_m,
            localMin_m: { east_m: -R, north_m: -R, up_m: -up },
            localMax_m: { east_m: R, north_m: R, up_m: up }
        });
        if (!parentBox.ok || !parentBox.result) {
            return { ok: false, status: 502, message: parentBox.error || 'python geodesy failed' };
        }

        const childBox = await runQuantumPython<{
            aabbMinEcef_m: number[];
            aabbMaxEcef_m: number[];
        }>({
            op: 'ecef_box_from_local',
            lat: zone.gps.lat,
            lon: zone.gps.lon,
            alt_m: zone.gps.alt_m,
            body: zone.gps.body,
            planetRadius_m: zone.gps.planetRadius_m,
            localMin_m: volume.localMin_m,
            localMax_m: volume.localMax_m
        });
        if (!childBox.ok || !childBox.result) {
            return { ok: false, status: 502, message: childBox.error || 'python geodesy failed' };
        }

        const contain = await runQuantumPython<{ contained: boolean }>({
            op: 'aabb_contains',
            innerMinEcef_m: childBox.result.aabbMinEcef_m,
            innerMaxEcef_m: childBox.result.aabbMaxEcef_m,
            outerMinEcef_m: parentBox.result.aabbMinEcef_m,
            outerMaxEcef_m: parentBox.result.aabbMaxEcef_m
        });
        if (!contain.ok || !contain.result?.contained) {
            return {
                ok: false,
                status: 422,
                message: 'transmutation volume AABB is not contained in default safety envelope (expand safety or shrink volume)'
            };
        }

        zone.transmutationVolumes.push(volume);
        zone.lastUpdated = Date.now();
        this.zones.set(zoneId, zone);
        return { ok: true, volume };
    }
}
