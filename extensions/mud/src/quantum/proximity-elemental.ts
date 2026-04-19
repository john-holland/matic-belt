import type { ProximityEntity } from './quantum-zone-types';

/**
 * Toy mass fractions for proximity protection scoring (simulation only).
 */
export function assumedHumanElementalMassFraction(weight_kg?: number, bmi?: number): Record<string, number> {
    const w = weight_kg ?? 70;
    const b = bmi ?? 22;
    const waterBoost = Math.max(0, Math.min(0.15, (b - 22) * 0.005));
    const waterFrac = 0.58 + waterBoost;
    const dry = 1 - waterFrac;
    // Water: H 11.2%, O 88.8% by mass
    const h_w = 0.112 * waterFrac;
    const o_w = 0.888 * waterFrac;
    // Dry lean soft tissue (very rough)
    const c_d = 0.23 * dry;
    const h_d = 0.1 * dry;
    const n_d = 0.032 * dry;
    const o_d = 0.55 * dry;
    const p_d = 0.011 * dry;
    const s_d = 0.002 * dry;
    const na_d = 0.0015 * dry;
    const k_d = 0.002 * dry;
    const ca_d = 0.018 * dry;
    const out: Record<string, number> = {
        H: h_w + h_d,
        O: o_w + o_d,
        C: c_d,
        N: n_d,
        P: p_d,
        S: s_d,
        Na: na_d,
        K: k_d,
        Ca: ca_d
    };
    const sum = Object.values(out).reduce((a, b) => a + b, 0);
    for (const k of Object.keys(out)) {
        out[k] /= sum;
    }
    void w;
    return out;
}

export function assumedAnimalElementalMassFraction(): Record<string, number> {
    return assumedHumanElementalMassFraction(25, 20);
}

export function resolveEntityElementalProfile(e: ProximityEntity): Record<string, number> {
    if (e.customElementalMassFraction && Object.keys(e.customElementalMassFraction).length > 0) {
        return normalizeFractions(e.customElementalMassFraction);
    }
    if (e.kind === 'human') {
        return assumedHumanElementalMassFraction(e.weight_kg, e.bmi);
    }
    return assumedAnimalElementalMassFraction();
}

function normalizeFractions(m: Record<string, number>): Record<string, number> {
    const s = Object.values(m).reduce((a, b) => a + Math.abs(b), 0) || 1;
    const o: Record<string, number> = {};
    for (const [k, v] of Object.entries(m)) {
        o[k] = Math.max(0, v) / s;
    }
    return o;
}
