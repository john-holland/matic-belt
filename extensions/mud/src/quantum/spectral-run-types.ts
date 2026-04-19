import type { SpectrographicData } from './spectrographic-analyzer';

export type { SpectrographicData } from './spectrographic-analyzer';

/** One persisted spectrometer / spectroscopy simulation run (not laboratory data). */
export interface SpectroRunDataSheet {
    runId: string;
    /** Key for the mined volume or sector (e.g. galactic systemId). */
    sectorId: string;
    zoneId?: string;
    recordedAt: number;
    spectrum: SpectrographicData;
    analyzer: {
        hasAnomalies: boolean;
        anomalies: string[];
        confidence: number;
    };
    /** 0–1 simulation score: higher suggests patterns inconsistent with mining-only physics. */
    interventionScore: number;
    /** True when policy says the run looks like unabated natural/mining-only physics. */
    physicsUnabated: boolean;
    notes: string[];
}
