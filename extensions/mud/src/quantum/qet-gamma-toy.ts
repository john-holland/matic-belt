/**
 * Toy Quantum Energy Transfer (QET) gamma-photon budget (simulation only).
 * In-fiction label: "yamma" high-energy channel — not real QET, GR, or radiative transport.
 *
 * Env (simulation policy, not regulatory):
 * - `QET_GAMMA_FIELD_CAP_W_SIM` — upper bound on allowed toy transfer power (default 1e12).
 */

export type CompactObjectKind = 'black_hole' | 'quasar' | 'star' | 'solar_mass_stub';

export interface CompactObjectStub {
    kind: CompactObjectKind;
    /** Toy stellar-mass scale (solar masses). */
    massSolar: number;
    /** Source distance in light-years (toy). */
    distanceLy: number;
    /** Optional sky position (degrees, ICRS-like toy frame). */
    ra_deg?: number;
    dec_deg?: number;
    /** Optional override for toy redshift factor (0 = ignore). */
    redshift_z?: number;
}

export interface ObserverFrame {
    lat: number;
    lon: number;
    alt_m: number;
    body: 'earth' | 'mars' | 'custom';
    /** Unix seconds for stub subsolar / diurnal model (no ephemeris). */
    unixTime_s?: number;
}

export interface QetTransferRequest {
    observer: ObserverFrame;
    compactObject: CompactObjectStub;
    /** Requested toy power draw (simulation watts). */
    powerDemand_W_SIM: number;
    /** Toy QET field scale (meters). */
    fieldRadius_m: number;
    /** 0–1 optional efficiency hint (defaults 0.85). */
    qetEfficiencyHint?: number;
}

export interface QetGammaBudgetResult {
    allowedTransfer_W_SIM: number;
    strayGammaIndex_SIM: number;
    gravitationalDilationFactor_SIM: number;
    solarObjectAlignment_SIM: number;
    budgetRemaining_W_SIM: number;
    warnings: string[];
    /** Narrative echo for UIs ("yamma"). */
    channelLabel: 'gamma' | 'yamma';
}

function fieldCapSim_W(): number {
    const v = Number(process.env.QET_GAMMA_FIELD_CAP_W_SIM);
    return Number.isFinite(v) && v > 0 ? v : 1e12;
}

const EPS = 1e-9;

/** Toy monotone dilation from mass/distance (capped per plan fiction). */
export function toyGravitationalDilation_SIM(o: CompactObjectStub): number {
    const mass = Math.max(EPS, o.massSolar);
    const dist = Math.max(1e-6, o.distanceLy);
    let base = mass / dist;
    if (o.kind === 'black_hole') base *= 1.15;
    if (o.kind === 'quasar') base *= 1.05;
    if (o.redshift_z != null && Number.isFinite(o.redshift_z) && o.redshift_z > 0) {
        base *= 1 + Math.min(0.5, o.redshift_z * 0.1);
    }
    const raw = 0.5 + 1.5 * Math.tanh(base / 25);
    return Math.min(2, Math.max(0.5, raw));
}

/** Stub sun direction in a toy Earth-centered frame (not VSOP87). */
export function stubSunDirectionEcef_UNIT(observer: ObserverFrame): [number, number, number] {
    const t = observer.unixTime_s ?? Date.now() / 1000;
    const dayFrac = (t % 86400) / 86400;
    const subsolarLon_deg = dayFrac * 360 - 180;
    const lonSun = (subsolarLon_deg * Math.PI) / 180;
    const decSun = ((23.45 * Math.sin((2 * Math.PI * ((t / 86400) % 365.25)) / 365.25)) * Math.PI) / 180;
    const cl = Math.cos(decSun);
    return [cl * Math.cos(lonSun), cl * Math.sin(lonSun), Math.sin(decSun)];
}

/** Unit direction to compact object from toy ra/dec (Earth-centered sky). */
export function stubCompactObjectDirection_UNIT(o: CompactObjectStub): [number, number, number] {
    const ra = ((o.ra_deg ?? 180) * Math.PI) / 180;
    const dec = ((o.dec_deg ?? 0) * Math.PI) / 180;
    const cd = Math.cos(dec);
    return [cd * Math.cos(ra), cd * Math.sin(ra), Math.sin(dec)];
}

function dot(a: [number, number, number], b: [number, number, number]): number {
    return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function norm(v: [number, number, number]): [number, number, number] {
    const n = Math.sqrt(v[0] ** 2 + v[1] ** 2 + v[2] ** 2) || 1;
    return [v[0] / n, v[1] / n, v[2] / n];
}

/** Observer "up" / radial outward unit (spherical planet toy). */
export function observerRadialUnit(observer: ObserverFrame): [number, number, number] {
    const φ = (observer.lat * Math.PI) / 180;
    const λ = (observer.lon * Math.PI) / 180;
    const cφ = Math.cos(φ);
    return norm([cφ * Math.cos(λ), cφ * Math.sin(λ), Math.sin(φ)]);
}

/**
 * Toy alignment: mix of sun–object sky alignment and observer-up vs object (fiction).
 */
export function toySolarObjectAlignment_SIM(observer: ObserverFrame, o: CompactObjectStub): number {
    const sun = stubSunDirectionEcef_UNIT(observer);
    const obj = stubCompactObjectDirection_UNIT(o);
    const up = observerRadialUnit(observer);
    const skyAlign = Math.max(0, Math.min(1, (dot(sun, obj) + 1) / 2));
    const limbAlign = Math.max(0, Math.min(1, (dot(up, obj) + 1) / 2));
    return Math.max(0, Math.min(1, 0.55 * skyAlign + 0.45 * limbAlign));
}

/**
 * Main QET gamma budget (toy).
 */
export function computeQetGammaBudget(req: QetTransferRequest, opts?: { narrativeYamma?: boolean }): QetGammaBudgetResult {
    const warnings: string[] = ['simulation: QET gamma budget is toy physics only'];
    const cap = fieldCapSim_W();
    const efficiency = Math.min(1, Math.max(0.05, req.qetEfficiencyHint ?? 0.85));
    const dilation = toyGravitationalDilation_SIM(req.compactObject);
    const alignment = toySolarObjectAlignment_SIM(req.observer, req.compactObject);

    const fieldScale = Math.max(1, req.fieldRadius_m);
    const fieldGain = Math.min(1, 1e7 / fieldScale);

    const rawAllowed = cap * alignment * dilation * efficiency * fieldGain;
    const demand = Math.max(0, req.powerDemand_W_SIM);
    const allowedTransfer_W_SIM = Math.min(demand, rawAllowed, cap);

    const strayGammaIndex_SIM = Math.max(
        0,
        Math.min(1, 0.35 + 0.4 * (1 - alignment) + 0.15 * (2 - dilation) + 0.1 * (1 - fieldGain))
    );

    const budgetRemaining_W_SIM = Math.max(0, cap - allowedTransfer_W_SIM);

    if (demand > cap) {
        warnings.push('powerDemand exceeds QET_GAMMA_FIELD_CAP_W_SIM; output clamped');
    }

    return {
        allowedTransfer_W_SIM,
        strayGammaIndex_SIM,
        gravitationalDilationFactor_SIM: dilation,
        solarObjectAlignment_SIM: alignment,
        budgetRemaining_W_SIM,
        warnings,
        channelLabel: opts?.narrativeYamma ? 'yamma' : 'gamma'
    };
}
