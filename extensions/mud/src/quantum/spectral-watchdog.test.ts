import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { QuantumZoneService } from './quantum-zone-service';
import { SpectrographicAnalyzer } from './spectrographic-analyzer';
import { SpectroRunSheetStore } from './spectro-run-sheet-store';
import { SpectralWatchdog } from './spectral-watchdog';

describe('SpectralWatchdog', () => {
    let tmpDir: string;
    let store: SpectroRunSheetStore;
    let zoneService: QuantumZoneService;
    let analyzer: SpectrographicAnalyzer;

    beforeEach(() => {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'spectral-wd-'));
        store = new SpectroRunSheetStore(path.join(tmpDir, 'runs.jsonl'));
        zoneService = new QuantumZoneService(null);
        analyzer = new SpectrographicAnalyzer();
        delete process.env.SPECTRAL_INTERVENTION_THRESHOLD;
        delete process.env.SPECTRAL_CLEAR_RUNS_TO_RELEASE;
    });

    afterEach(() => {
        try {
            fs.rmSync(tmpDir, { recursive: true, force: true });
        } catch {
            /* ignore */
        }
    });

    const calmSpectrum = {
        timestamp: Date.now(),
        wavelength: 500,
        intensity: 0.2,
        elements: ['C', 'O', 'N'],
        anomalies: []
    };

    it('sets global teleport hold when intervention score exceeds threshold', async () => {
        process.env.SPECTRAL_INTERVENTION_THRESHOLD = '0.15';
        const w = new SpectralWatchdog(analyzer, store, zoneService);
        const wild = {
            ...calmSpectrum,
            intensity: 50,
            elements: ['Xe', 'Kr', 'U']
        };
        const sheet = await w.recordAndEvaluateRun({
            sectorId: 'sec-1',
            data: wild,
            cron: false
        });
        expect(sheet.physicsUnabated).toBe(false);
        expect(zoneService.getGlobalTeleportationHold().active).toBe(true);
    });

    it('clears hold after consecutive clean runs', async () => {
        process.env.SPECTRAL_CLEAR_RUNS_TO_RELEASE = '2';
        const w2 = new SpectralWatchdog(analyzer, store, zoneService);
        zoneService.setGlobalTeleportationHold(true, 'test');
        await w2.recordAndEvaluateRun({ sectorId: 's', data: calmSpectrum, cron: false });
        expect(zoneService.getGlobalTeleportationHold().active).toBe(true);
        await w2.recordAndEvaluateRun({ sectorId: 's', data: { ...calmSpectrum, timestamp: calmSpectrum.timestamp + 1 }, cron: false });
        expect(zoneService.getGlobalTeleportationHold().active).toBe(false);
    });
});
