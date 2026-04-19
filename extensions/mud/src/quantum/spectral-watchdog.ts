import { randomUUID } from 'crypto';
import type { QuantumZoneService } from './quantum-zone-service';
import type { SpectroRunDataSheet } from './spectral-run-types';
import { SpectroRunSheetStore } from './spectro-run-sheet-store';
import type { SpectrographicAnalyzer, SpectrographicData, SpectrographyContext } from './spectrographic-analyzer';

/** Simulation policy (not dosimetry / regulation). Parsed once per process. */
function interventionThreshold(): number {
    const v = Number(process.env.SPECTRAL_INTERVENTION_THRESHOLD);
    return Number.isFinite(v) && v > 0 && v <= 1 ? v : 0.65;
}

function clearRunsToReleaseHold(): number {
    const v = Number(process.env.SPECTRAL_CLEAR_RUNS_TO_RELEASE);
    return Number.isFinite(v) && v >= 1 ? Math.floor(v) : 3;
}

export interface SpectralWatchdogLastResult {
    sectorId: string;
    runId: string;
    recordedAt: number;
    physicsUnabated: boolean;
    interventionScore: number;
    cron: boolean;
}

/**
 * Records spectral run sheets, scores intervention likelihood, and toggles global teleport hold.
 */
export class SpectralWatchdog {
    /** Any monitored sector must stay clean; one dirty run resets the streak. */
    private globalCleanStreak = 0;
    private lastCronBySector = new Map<string, SpectralWatchdogLastResult>();

    constructor(
        private readonly analyzer: SpectrographicAnalyzer,
        private readonly store: SpectroRunSheetStore,
        private readonly zoneService: QuantumZoneService
    ) {}

    getLastScheduledResult(sectorId: string): SpectralWatchdogLastResult | null {
        return this.lastCronBySector.get(sectorId) ?? null;
    }

    listLastCronResults(): SpectralWatchdogLastResult[] {
        return [...this.lastCronBySector.values()];
    }

    listRecentRuns(sectorId: string, limit: number): SpectroRunDataSheet[] {
        const mem = this.store.getRecentInMemory(sectorId, limit);
        if (mem.length >= limit) return mem.slice(-limit);
        return this.store.readRecentFromDisk(sectorId, limit);
    }

    async recordAndEvaluateRun(params: {
        sectorId: string;
        data: SpectrographicData;
        miningBaseline?: SpectrographyContext['miningBaseline'];
        zoneId?: string;
        cron?: boolean;
        /** When set, used instead of last appended sheet (cron re-eval of history). */
        previousOverride?: SpectrographicData | null;
    }): Promise<SpectroRunDataSheet> {
        const lastSheet = this.store.getLastInMemory(params.sectorId);
        const previousFromStore = lastSheet?.spectrum ?? null;
        const previous =
            params.previousOverride !== undefined ? params.previousOverride : previousFromStore;
        const ctx: SpectrographyContext = {
            previous,
            miningBaseline: params.miningBaseline
        };

        const analyzerResult = await this.analyzer.analyzeSpectrography(params.data, ctx);
        const interventionScore = Math.min(
            1,
            analyzerResult.confidence * 0.55 +
                analyzerResult.miningDeviationScore * 0.35 +
                (analyzerResult.hasAnomalies ? 0.1 : 0)
        );

        const thr = interventionThreshold();
        const physicsUnabated = interventionScore < thr;

        const notes: string[] = [
            'simulation: spectral watchdog policy only',
            `interventionThreshold=${thr}`,
            `miningDeviation=${analyzerResult.miningDeviationScore.toFixed(3)}`
        ];

        const sheet: SpectroRunDataSheet = {
            runId: randomUUID(),
            sectorId: params.sectorId,
            zoneId: params.zoneId,
            recordedAt: Date.now(),
            spectrum: params.data,
            analyzer: {
                hasAnomalies: analyzerResult.hasAnomalies,
                anomalies: analyzerResult.anomalies,
                confidence: analyzerResult.confidence
            },
            interventionScore,
            physicsUnabated,
            notes
        };

        this.store.append(sheet);
        this.applyHoldPolicy(params.sectorId, physicsUnabated, params.cron === true);
        if (params.cron) {
            this.lastCronBySector.set(params.sectorId, {
                sectorId: params.sectorId,
                runId: sheet.runId,
                recordedAt: sheet.recordedAt,
                physicsUnabated,
                interventionScore,
                cron: true
            });
        }

        return sheet;
    }

    /**
     * Re-evaluate the last stored sheet for a sector (cron path when no new POST sample).
     */
    async reEvaluateLastRunForSector(sectorId: string): Promise<SpectroRunDataSheet | null> {
        const recent = this.listRecentRuns(sectorId, 2);
        if (!recent.length) return null;
        const last = recent[recent.length - 1]!;
        const prevSpectrum = recent.length >= 2 ? recent[recent.length - 2]!.spectrum : null;
        return this.recordAndEvaluateRun({
            sectorId,
            data: last.spectrum,
            miningBaseline: undefined,
            zoneId: last.zoneId,
            cron: true,
            previousOverride: prevSpectrum
        });
    }

    private applyHoldPolicy(_sectorId: string, physicsUnabated: boolean, _fromCron: boolean): void {
        if (!physicsUnabated) {
            this.globalCleanStreak = 0;
            this.zoneService.setGlobalTeleportationHold(true, 'spectral_intervention_likely');
            return;
        }

        this.globalCleanStreak++;
        const need = clearRunsToReleaseHold();
        if (this.globalCleanStreak >= need && this.zoneService.getGlobalTeleportationHold().active) {
            this.zoneService.setGlobalTeleportationHold(false, 'spectral_clear_streak');
        }
    }
}
