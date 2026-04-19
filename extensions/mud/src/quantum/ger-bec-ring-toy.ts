/**
 * THE GALACTIC ENERGY RELAY (GER) PROTOCOL — toy simulation only (v0.1a fiction).
 * Entangled BEC “rings” at density gradients to bend light and store energy in
 * lossy super-capacitor buffers. Ring planes may be oriented ~perpendicular to
 * a toy ecliptic axis for narrative “solar system” alignment (not orbital mechanics).
 */

export type EnergyLoopState = 'Stable' | 'Critical' | 'Discharging' | 'Harmonic_Loss';

export type RadiationChannel = 'Gamma' | 'X-Ray';

export interface QuantumSOTA {
    /** Milliseconds (fiction: “years” of coherence stated in narrative only). */
    coherenceTime: number;
    /** 0–1 accuracy of the remote entanglement link (simulation). */
    entanglementFidelity: number;
    coolingEfficiency: 'Active_Cryo' | 'Passive_Deep_Space' | 'Laser_Cooled';
}

/**
 * Optional ring geometry: tilt of the BEC ring plane normal away from the toy ecliptic +Z (degrees).
 * ~90° reads as “perpendicular” to the nominal solar-system disk in this stub.
 */
export interface RingOrientationToy {
    /** Degrees; 90 ≈ perpendicular to toy ecliptic plane. */
    eclipticNormalTilt_deg: number;
}

export interface EntangledBECZone<T extends RadiationChannel = RadiationChannel> {
    id: string;
    location: 'Earth_Orbit' | 'L1_Lagrange' | 'Quasar_Proximity';
    /** Radiation species this zone is typed for (fiction). */
    radiation: T;
    densityGradient: number;
    vortexSpinRate: number;
    buffer: {
        capacity: bigint;
        currentLoad: bigint;
        decayRate: number;
    };
    quantumMetrics: QuantumSOTA;
    ringOrientation?: RingOrientationToy;
}

export interface InterstellarGridController {
    establishEntanglementLink<T extends RadiationChannel>(
        local: EntangledBECZone<T>,
        remote: EntangledBECZone<T>
    ): boolean;
    triggerDischarge(zoneId: string, targetOutput: number): Promise<void>;
    manageThermalEquilibrium(zoneId: string): void;
}

/** Example from GER fiction — not a live asset. */
export const exampleEarthGammaBecZone: EntangledBECZone<'Gamma'> = {
    id: 'TERRA-CAP-01',
    location: 'L1_Lagrange',
    radiation: 'Gamma',
    densityGradient: 0.999,
    vortexSpinRate: 450_000,
    buffer: {
        capacity: 1_000_000n,
        currentLoad: 500_000n,
        decayRate: 0.0001
    },
    quantumMetrics: {
        coherenceTime: 3.154e10,
        entanglementFidelity: 0.99,
        coolingEfficiency: 'Passive_Deep_Space'
    },
    ringOrientation: { eclipticNormalTilt_deg: 90 }
};

function tiltBonus(orientation?: RingOrientationToy): number {
    if (!orientation) return 1;
    const t = Math.abs(orientation.eclipticNormalTilt_deg);
    const perp = Math.abs(t - 90);
    return 1 + Math.max(0, (15 - perp) / 150);
}

function minBig(a: bigint, b: bigint): bigint {
    return a < b ? a : b;
}

export function zoneToJsonSafe(z: EntangledBECZone): Record<string, unknown> {
    return {
        ...z,
        buffer: {
            capacity: z.buffer.capacity.toString(),
            currentLoad: z.buffer.currentLoad.toString(),
            decayRate: z.buffer.decayRate
        }
    };
}

export function parseZoneFromBody(body: Record<string, unknown>): EntangledBECZone | null {
    if (!body.id || !body.location || !body.radiation) return null;
    const cap = body.buffer && (body.buffer as Record<string, unknown>).capacity;
    const load = body.buffer && (body.buffer as Record<string, unknown>).currentLoad;
    if (cap == null || load == null) return null;
    const capB = BigInt(String(cap));
    const loadB = BigInt(String(load));
    const qm = (body.quantumMetrics || {}) as Record<string, unknown>;
    if (qm.coherenceTime == null || qm.entanglementFidelity == null || !qm.coolingEfficiency) return null;
    const ro = body.ringOrientation as Record<string, unknown> | undefined;
    return {
        id: String(body.id),
        location: body.location as EntangledBECZone['location'],
        radiation: body.radiation as RadiationChannel,
        densityGradient: Number(body.densityGradient ?? 0),
        vortexSpinRate: Number(body.vortexSpinRate ?? 0),
        buffer: {
            capacity: capB,
            currentLoad: loadB,
            decayRate: Number((body.buffer as Record<string, unknown>).decayRate ?? 0)
        },
        quantumMetrics: {
            coherenceTime: Number(qm.coherenceTime),
            entanglementFidelity: Number(qm.entanglementFidelity),
            coolingEfficiency: qm.coolingEfficiency as QuantumSOTA['coolingEfficiency']
        },
        ringOrientation:
            ro?.eclipticNormalTilt_deg != null
                ? { eclipticNormalTilt_deg: Number(ro.eclipticNormalTilt_deg) }
                : undefined
    };
}

/**
 * In-memory GER toy controller (one instance per quantum router).
 */
export class GerBecRingToyController implements InterstellarGridController {
    private readonly zones = new Map<string, EntangledBECZone>();
    private readonly entangledWith = new Map<string, string>();
    private readonly loopState = new Map<string, EnergyLoopState>();

    registerZone(zone: EntangledBECZone): void {
        this.zones.set(zone.id, zone);
        this.loopState.set(zone.id, 'Stable');
    }

    getZone(id: string): EntangledBECZone | undefined {
        return this.zones.get(id);
    }

    listZones(): EntangledBECZone[] {
        return [...this.zones.values()];
    }

    getLoopState(id: string): EnergyLoopState | undefined {
        return this.loopState.get(id);
    }

    establishEntanglementLink<T extends RadiationChannel>(
        local: EntangledBECZone<T>,
        remote: EntangledBECZone<T>
    ): boolean {
        if (local.radiation !== remote.radiation) return false;
        const f = Math.min(local.quantumMetrics.entanglementFidelity, remote.quantumMetrics.entanglementFidelity);
        const b =
            tiltBonus(local.ringOrientation) *
            tiltBonus(remote.ringOrientation) *
            (0.5 + 0.5 * f) *
            (0.9 + 0.1 * ((local.densityGradient + remote.densityGradient) / 2));
        if (b < 0.55) return false;
        this.entangledWith.set(local.id, remote.id);
        this.entangledWith.set(remote.id, local.id);
        return true;
    }

    async triggerDischarge(zoneId: string, targetOutput: number): Promise<void> {
        const z = this.zones.get(zoneId);
        if (!z) return;
        const out = BigInt(Math.max(0, Math.floor(targetOutput)));
        const take = minBig(out, z.buffer.currentLoad);
        const next: EntangledBECZone = {
            ...z,
            buffer: { ...z.buffer, currentLoad: z.buffer.currentLoad - take }
        };
        this.zones.set(zoneId, next);
        this.loopState.set(zoneId, take > 0n ? 'Discharging' : 'Stable');
        await Promise.resolve();
    }

    manageThermalEquilibrium(zoneId: string): void {
        const z = this.zones.get(zoneId);
        if (!z) return;
        const dec = Math.min(0.05, Math.max(0, z.buffer.decayRate));
        const numer = BigInt(Math.max(1, Math.round(dec * 1e8)));
        const loss = (z.buffer.currentLoad * numer) / 100_000_000n;
        const nextLoad = z.buffer.currentLoad > loss ? z.buffer.currentLoad - loss : 0n;
        const next: EntangledBECZone = {
            ...z,
            buffer: { ...z.buffer, currentLoad: nextLoad }
        };
        this.zones.set(zoneId, next);
        const capN = next.buffer.capacity > 0n ? next.buffer.capacity : 1n;
        const frac = Number((nextLoad * 10000n) / capN) / 10000;
        this.loopState.set(zoneId, frac > 0.95 ? 'Critical' : frac < 0.1 ? 'Harmonic_Loss' : 'Stable');
    }

    getEntanglementPeer(zoneId: string): string | undefined {
        return this.entangledWith.get(zoneId);
    }
}

export function createGerBecRingToyController(): GerBecRingToyController {
    return new GerBecRingToyController();
}
