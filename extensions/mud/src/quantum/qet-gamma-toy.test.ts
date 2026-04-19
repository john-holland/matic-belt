import {
    computeQetGammaBudget,
    stubSunDirectionEcef_UNIT,
    toyGravitationalDilation_SIM,
    toySolarObjectAlignment_SIM,
    type ObserverFrame,
    type QetTransferRequest
} from './qet-gamma-toy';

function unitToRaDec_deg(u: [number, number, number]): { ra_deg: number; dec_deg: number } {
    const [x, y, z] = u;
    const dec = (Math.asin(Math.max(-1, Math.min(1, z))) * 180) / Math.PI;
    let ra = (Math.atan2(y, x) * 180) / Math.PI;
    if (ra < 0) ra += 360;
    return { ra_deg: ra, dec_deg: dec };
}

const baseObserver: ObserverFrame = {
    lat: 40,
    lon: -74,
    alt_m: 100,
    body: 'earth',
    unixTime_s: 1_700_000_000
};

function baseRequest(over: Partial<QetTransferRequest> = {}): QetTransferRequest {
    return {
        observer: baseObserver,
        compactObject: {
            kind: 'star',
            massSolar: 10,
            distanceLy: 100,
            ra_deg: 90,
            dec_deg: 10
        },
        powerDemand_W_SIM: 1e9,
        fieldRadius_m: 1e7,
        qetEfficiencyHint: 0.9,
        ...over
    };
}

describe('toyGravitationalDilation_SIM', () => {
    it('orders black_hole >= quasar >= star at same mass and distance', () => {
        const common = { massSolar: 1e8, distanceLy: 50, ra_deg: 0, dec_deg: 45 };
        const dBh = toyGravitationalDilation_SIM({ kind: 'black_hole', ...common });
        const dQ = toyGravitationalDilation_SIM({ kind: 'quasar', ...common });
        const dSt = toyGravitationalDilation_SIM({ kind: 'star', ...common });
        expect(dBh).toBeGreaterThanOrEqual(dQ);
        expect(dQ).toBeGreaterThanOrEqual(dSt);
    });
});

describe('toySolarObjectAlignment_SIM', () => {
    it('returns value in 0..1', () => {
        const a = toySolarObjectAlignment_SIM(baseObserver, baseRequest().compactObject);
        expect(a).toBeGreaterThanOrEqual(0);
        expect(a).toBeLessThanOrEqual(1);
    });
});

describe('computeQetGammaBudget', () => {
    const prevCap = process.env.QET_GAMMA_FIELD_CAP_W_SIM;

    afterEach(() => {
        if (prevCap === undefined) delete process.env.QET_GAMMA_FIELD_CAP_W_SIM;
        else process.env.QET_GAMMA_FIELD_CAP_W_SIM = prevCap;
    });

    it('sun-aligned object yields at least as much alignment and transfer as anti-sun object', () => {
        const obs = { ...baseObserver, unixTime_s: 1_234_567 };
        const sun = stubSunDirectionEcef_UNIT(obs);
        const anti: [number, number, number] = [-sun[0], -sun[1], -sun[2]];
        const co = { kind: 'star' as const, massSolar: 5, distanceLy: 20 };
        const hi = computeQetGammaBudget(
            {
                observer: obs,
                compactObject: { ...co, ...unitToRaDec_deg(sun) },
                powerDemand_W_SIM: 1e15,
                fieldRadius_m: 1e7
            },
            {}
        );
        const lo = computeQetGammaBudget(
            {
                observer: obs,
                compactObject: { ...co, ...unitToRaDec_deg(anti) },
                powerDemand_W_SIM: 1e15,
                fieldRadius_m: 1e7
            },
            {}
        );
        expect(hi.solarObjectAlignment_SIM).toBeGreaterThanOrEqual(lo.solarObjectAlignment_SIM);
        expect(hi.allowedTransfer_W_SIM).toBeGreaterThanOrEqual(lo.allowedTransfer_W_SIM - 1e-6);
    });

    it('clamps extreme power demand to cap', () => {
        process.env.QET_GAMMA_FIELD_CAP_W_SIM = '1e6';
        const r = computeQetGammaBudget(
            {
                ...baseRequest(),
                powerDemand_W_SIM: 1e30,
                fieldRadius_m: 1e6,
                qetEfficiencyHint: 1
            },
            {}
        );
        expect(r.allowedTransfer_W_SIM).toBeLessThanOrEqual(1e6);
        expect(r.warnings.some((w) => w.includes('QET_GAMMA_FIELD_CAP'))).toBe(true);
    });

    it('sets channelLabel yamma when requested', () => {
        const r = computeQetGammaBudget(baseRequest(), { narrativeYamma: true });
        expect(r.channelLabel).toBe('yamma');
    });
});
