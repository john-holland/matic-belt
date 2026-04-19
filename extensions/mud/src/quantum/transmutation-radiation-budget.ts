/**
 * Toy simulated dose-rate budget (μSv/h) for anchored transmutation / teleport fiction.
 * Not dosimetry or regulatory limits — see exported *SIM* constants.
 */

/** Matches narrative baseline in stability-zone-analyzer Earth defaults (μSv/h). */
export const EARTH_AMBIENT_RADIATION_SIM_uSv_PER_H = 0.1;

/** Simulation policy: totals at or below this are treated as “none–healthy” for tests. */
export const HEALTHY_SIM_TOTAL_MAX_U_SV_H = 5;

/** Simulation policy: hard ceiling so stressed inputs never read as “dangerous” in-app tests. */
export const NEVER_DANGEROUS_SIM_TOTAL_MAX_U_SV_H = 30;

/** Ignore pathological client ambient values beyond this when summing (μSv/h). */
const SIM_AMBIENT_INPUT_CAP_U_SV_H = 20;

/** Max contribution from laptop–sensor coupling (μSv/h). */
const SIM_COUPLING_CAP_U_SV_H = 0.45;

/** Max contribution from tunneling probability term (μSv/h). */
const SIM_TUNNELING_CAP_U_SV_H = 0.2;

export interface TransmutationRadiationBudget {
    /** Ambient dose rate used in the sum (μSv/h), after clamping. */
    ambient_uSv_h: number;
    /** Extra simulated rate from geometry + tunneling (μSv/h). */
    process_uSv_h: number;
    /** ambient + process (μSv/h). */
    total_uSv_h: number;
}

function clampAmbient(ambient_uSv_h: number): number {
    const v = Number.isFinite(ambient_uSv_h) ? ambient_uSv_h : EARTH_AMBIENT_RADIATION_SIM_uSv_PER_H;
    return Math.min(SIM_AMBIENT_INPUT_CAP_U_SV_H, Math.max(0, v));
}

function couplingFromSeparation_m(separation_m: number): number {
    const d = Number.isFinite(separation_m) && separation_m > 0 ? separation_m : 0.5;
    return Math.min(SIM_COUPLING_CAP_U_SV_H, 0.12 / Math.max(d, 0.04));
}

function tunnelingTerm(tunnelingProbability: number): number {
    const t = Number.isFinite(tunnelingProbability) ? tunnelingProbability : 0;
    const clamped = Math.min(1, Math.max(0, t));
    return Math.min(SIM_TUNNELING_CAP_U_SV_H, 0.18 * clamped);
}

/**
 * Combined operational dose rate (simulation only).
 */
export function transmutationRadiationBudget_uSvH(params: {
    ambientRadiation_uSv_h?: number;
    separation_m: number;
    tunnelingProbability: number;
}): TransmutationRadiationBudget {
    const ambient_uSv_h = clampAmbient(
        params.ambientRadiation_uSv_h ?? EARTH_AMBIENT_RADIATION_SIM_uSv_PER_H
    );
    const coupling = couplingFromSeparation_m(params.separation_m);
    const tunnel = tunnelingTerm(params.tunnelingProbability);
    const process_uSv_h = coupling + tunnel;
    return {
        ambient_uSv_h,
        process_uSv_h,
        total_uSv_h: ambient_uSv_h + process_uSv_h
    };
}
