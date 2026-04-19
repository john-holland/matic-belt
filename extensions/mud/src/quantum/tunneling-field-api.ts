import { runQuantumPython } from './quantum-python-runner';

export interface TunnelingVolumeRequest {
    /** Latitude (degrees). */
    lat: number;
    /** Longitude (degrees). */
    lon: number;
    /** Altitude above the surface model used with lat/lon (m = meters). */
    alt_m: number;
    body: 'earth' | 'mars' | 'custom';
    /** Reference sphere radius (m = meters). */
    planetRadius_m?: number;
    /** Surface pressure (Pa = pascals). */
    surfacePressure_Pa: number;
    /** Absolute temperature (K = kelvin). */
    temperature_K: number;
    /** Gravitational acceleration (m/s²: meters per second squared). */
    gravity_m_s2?: number;
    /** Potential barrier height (eV = electron-volts). */
    barrierHeight_eV: number;
    /** Particle kinetic energy scale (eV = electron-volts). */
    particleEnergy_eV: number;
    /** Dimensionless input (typically ~0–1): how uniform the toy tunneling field is. */
    fieldUniformity: number;
    /**
     * Half-extents for summary corners: ENU = local East-North-Up frame;
     * `_m` suffix = meters on each axis.
     */
    halfExtentEnu_m: {
        /** East offset half-extent (meters). */
        east_m: number;
        /** North offset half-extent (meters). */
        north_m: number;
        /** Up offset half-extent (meters). */
        up_m: number;
    };
}

export class TunnelingFieldApi {
    async summarizeVolume(req: TunnelingVolumeRequest): Promise<{
        /** Pressure at volume center (Pa = pascals). */
        centerPressure_Pa: number;
        /** Dimensionless: nominal tunneling probability at volume center. */
        tunnelingProbability: number;
        /** Effective barrier after field effects (eV = electron-volts). */
        effectiveBarrier_eV: number;
        /** Dimensionless model score for how uniform the field is at center. */
        fieldUniformityScore: number;
        cornerSamples: Array<{
            /** Corner position as ENU offset from center (m = meters). */
            offsetEnu_m: { east_m: number; north_m: number; up_m: number };
            /** Dimensionless: nominal tunneling probability at this corner sample. */
            tunnelingProbability: number;
        }>;
    } | null> {
        const center = await runQuantumPython<{
            pressure_Pa: number;
            tunnelingProbability: number;
            effectiveBarrier_eV: number;
            fieldUniformityScore: number;
        }>({
            op: 'tunneling_toy',
            lat: req.lat,
            lon: req.lon,
            alt_m: req.alt_m,
            body: req.body,
            planetRadius_m: req.planetRadius_m,
            surfacePressure_Pa: req.surfacePressure_Pa,
            temperature_K: req.temperature_K,
            gravity_m_s2: req.gravity_m_s2 ?? (req.body === 'mars' ? 3.71 : 9.80665),
            barrierHeight_eV: req.barrierHeight_eV,
            particleEnergy_eV: req.particleEnergy_eV,
            fieldUniformity: req.fieldUniformity
        });
        if (!center.ok || !center.result) {
            return null;
        }

        const h = req.halfExtentEnu_m;
        const corners: Array<{ east_m: number; north_m: number; up_m: number }> = [
            { east_m: h.east_m, north_m: h.north_m, up_m: h.up_m },
            { east_m: -h.east_m, north_m: h.north_m, up_m: h.up_m },
            { east_m: h.east_m, north_m: -h.north_m, up_m: h.up_m },
            { east_m: -h.east_m, north_m: -h.north_m, up_m: h.up_m }
        ];

        const cornerSamples: Array<{
            offsetEnu_m: { east_m: number; north_m: number; up_m: number };
            tunnelingProbability: number;
        }> = [];

        for (const o of corners) {
            const base = await runQuantumPython<{ ecef_m: number[] }>({
                op: 'ecef_with_offset',
                lat: req.lat,
                lon: req.lon,
                alt_m: req.alt_m,
                body: req.body,
                planetRadius_m: req.planetRadius_m,
                offsetEnu_m: o
            });
            if (!base.ok || !base.result) continue;
            // ecef_m: Earth-Centered Earth-Fixed [x,y,z] in meters.
            const r = Math.sqrt(
                base.result.ecef_m[0] ** 2 + base.result.ecef_m[1] ** 2 + base.result.ecef_m[2] ** 2
            );
            const pr = req.planetRadius_m ?? (req.body === 'mars' ? 3396190 : 6378137);
            // altCorner: altitude (m) from radial distance minus sphere radius (see alt_m on request).
            const altCorner = Math.max(0, r - pr);
            const t = await runQuantumPython<{ tunnelingProbability: number }>({
                op: 'tunneling_toy',
                lat: req.lat,
                lon: req.lon,
                alt_m: altCorner,
                body: req.body,
                planetRadius_m: req.planetRadius_m,
                surfacePressure_Pa: req.surfacePressure_Pa,
                temperature_K: req.temperature_K,
                gravity_m_s2: req.gravity_m_s2 ?? (req.body === 'mars' ? 3.71 : 9.80665),
                barrierHeight_eV: req.barrierHeight_eV,
                particleEnergy_eV: req.particleEnergy_eV,
                fieldUniformity: req.fieldUniformity * 0.98
            });
            cornerSamples.push({
                offsetEnu_m: o,
                tunnelingProbability: t.result?.tunnelingProbability ?? 0
            });
        }

        return {
            centerPressure_Pa: center.result.pressure_Pa ?? 0,
            tunnelingProbability: center.result.tunnelingProbability,
            effectiveBarrier_eV: center.result.effectiveBarrier_eV,
            fieldUniformityScore: center.result.fieldUniformityScore,
            cornerSamples
        };
    }
}
