export interface SpectrographicData {
    timestamp: number;
    wavelength: number;
    intensity: number;
    elements: string[];
    anomalies: string[];
    /** Optional per-bin intensities for history / baseline comparison (simulation). */
    intensitySeries?: number[];
    /** Optional tag for expected mining signature (simulation). */
    miningTag?: string;
}

export interface SpectrographyContext {
    /** Prior run in the same sector; enables deterministic drift detection. */
    previous?: SpectrographicData | null;
    /** Expected mining-only reference (intensity / elements / optional series). */
    miningBaseline?: Pick<SpectrographicData, 'intensity' | 'elements'> & {
        intensitySeries?: number[];
    };
}

interface BlacklistedSystem {
    id: string;
    name: string;
    reason: string;
    confidence: number;
    lastDetected: number;
    anomalies: string[];
}

export class SpectrographicAnalyzer {
    private blacklist: Map<string, BlacklistedSystem>;
    private readonly ANOMALY_THRESHOLD = 0.85;
    private readonly CONFIDENCE_THRESHOLD = 0.7;
    private readonly MAX_HISTORY_DAYS = 30;

    constructor() {
        this.blacklist = new Map();
    }

    /**
     * Analyze spectrographic data for anomalies.
     * When `ctx.previous` is set, rapid-change detection is deterministic vs that snapshot.
     */
    async analyzeSpectrography(
        data: SpectrographicData,
        ctx?: SpectrographyContext
    ): Promise<{
        hasAnomalies: boolean;
        anomalies: string[];
        confidence: number;
        miningDeviationScore: number;
    }> {
        const anomalies: string[] = [];
        let confidence = 0;

        if (this.hasUnnaturalCombinations(data.elements)) {
            anomalies.push('Unnatural element combinations detected');
            confidence += 0.3;
        }

        if (this.hasArtificialPatterns(data.intensity)) {
            anomalies.push('Artificial patterns detected in spectral intensity');
            confidence += 0.3;
        }

        if (this.hasRapidChangesVsHistory(data, ctx?.previous ?? null)) {
            anomalies.push('Rapid spectral changes vs prior run');
            confidence += 0.4;
        }

        const miningDeviationScore = this.compareToMiningBaseline(data, ctx?.miningBaseline);

        return {
            hasAnomalies: anomalies.length > 0,
            anomalies,
            confidence: Math.min(1, confidence),
            miningDeviationScore
        };
    }

    /**
     * 0–1 simulation score: how far `data` departs from a mining-only baseline (not regulatory).
     */
    compareToMiningBaseline(
        data: SpectrographicData,
        baseline?: Pick<SpectrographicData, 'intensity' | 'elements'> & { intensitySeries?: number[] }
    ): number {
        if (!baseline) return 0;
        const i0 = Math.max(1e-9, Math.abs(baseline.intensity));
        const i1 = Math.abs(data.intensity);
        const rel = Math.abs(i1 - i0) / i0;
        const intensityPart = Math.min(1, rel / 2);

        const setA = new Set((baseline.elements || []).map((e) => e.toUpperCase()));
        const setB = new Set((data.elements || []).map((e) => e.toUpperCase()));
        let extra = 0;
        for (const e of setB) {
            if (!setA.has(e)) extra++;
        }
        const elementPart = Math.min(1, extra / 8);

        let seriesPart = 0;
        const a = baseline.intensitySeries;
        const b = data.intensitySeries;
        if (a?.length && b?.length) {
            const n = Math.min(a.length, b.length);
            let maxRel = 0;
            for (let i = 0; i < n; i++) {
                const den = Math.max(1e-9, Math.abs(a[i]!));
                maxRel = Math.max(maxRel, Math.abs(b[i]! - a[i]!) / den);
            }
            seriesPart = Math.min(1, maxRel);
        }

        return Math.min(1, 0.45 * intensityPart + 0.35 * elementPart + 0.2 * seriesPart);
    }

    addToBlacklist(system: {
        id: string;
        name: string;
        anomalies: string[];
        confidence: number;
    }): void {
        if (system.confidence >= this.CONFIDENCE_THRESHOLD) {
            this.blacklist.set(system.id, {
                ...system,
                reason: this.generateBlacklistReason(system.anomalies),
                lastDetected: Date.now()
            });
        }
    }

    isBlacklisted(systemId: string): boolean {
        return this.blacklist.has(systemId);
    }

    getBlacklistInfo(systemId: string): BlacklistedSystem | null {
        return this.blacklist.get(systemId) || null;
    }

    cleanupBlacklist(): void {
        const cutoffTime = Date.now() - this.MAX_HISTORY_DAYS * 24 * 60 * 60 * 1000;
        for (const [id, system] of this.blacklist.entries()) {
            if (system.lastDetected < cutoffTime) {
                this.blacklist.delete(id);
            }
        }
    }

    private hasUnnaturalCombinations(elements: string[]): boolean {
        const naturalCombinations = [
            ['H', 'He'],
            ['C', 'O', 'N'],
            ['Si', 'O'],
            ['Fe', 'Ni'],
            ['Na', 'Cl']
        ];

        return !naturalCombinations.some((combination) =>
            combination.every((element) => elements.includes(element))
        );
    }

    private hasArtificialPatterns(intensity: number): boolean {
        const pattern = Math.sin(intensity) * Math.cos(intensity);
        return Math.abs(pattern) > this.ANOMALY_THRESHOLD;
    }

    /**
     * Deterministic drift vs previous snapshot (simulation policy thresholds).
     */
    hasRapidChangesVsHistory(data: SpectrographicData, previous: SpectrographicData | null): boolean {
        if (!previous) return false;
        const dtHours = Math.abs(data.timestamp - previous.timestamp) / (3600 * 1000);
        const i0 = Math.max(1e-9, Math.abs(previous.intensity));
        const relIntensity = Math.abs(data.intensity - previous.intensity) / i0;

        if (dtHours < 0.25 && relIntensity > 0.35) return true;
        if (relIntensity > 0.85) return true;

        const a = previous.intensitySeries;
        const b = data.intensitySeries;
        if (a?.length && b?.length) {
            const n = Math.min(a.length, b.length);
            for (let i = 0; i < n; i++) {
                const den = Math.max(1e-9, Math.abs(a[i]!));
                if (Math.abs(b[i]! - a[i]!) / den > 0.6) return true;
            }
        }

        return false;
    }

    private generateBlacklistReason(_anomalies: string[]): string {
        const reasons = [
            'Possible artificial spectral modulation',
            'Unnatural element distribution',
            'Rapid spectral changes inconsistent with natural processes',
            'Patterns suggesting intelligent manipulation',
            'Anomalous quantum signatures'
        ];

        return reasons[Math.floor(Math.random() * reasons.length)];
    }
}
