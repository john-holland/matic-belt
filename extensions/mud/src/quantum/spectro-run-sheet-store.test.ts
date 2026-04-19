import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import type { SpectroRunDataSheet } from './spectral-run-types';
import { SpectroRunSheetStore } from './spectro-run-sheet-store';

describe('SpectroRunSheetStore', () => {
    let tmpDir: string;
    let store: SpectroRunSheetStore;

    beforeEach(() => {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'spectral-runs-'));
        const filePath = path.join(tmpDir, 'runs.jsonl');
        store = new SpectroRunSheetStore(filePath);
    });

    afterEach(() => {
        try {
            fs.rmSync(tmpDir, { recursive: true, force: true });
        } catch {
            /* ignore */
        }
    });

    function sheet(sectorId: string, runId: string): SpectroRunDataSheet {
        return {
            runId,
            sectorId,
            recordedAt: Date.now(),
            spectrum: {
                timestamp: Date.now(),
                wavelength: 500,
                intensity: 1,
                elements: ['C', 'O', 'N'],
                anomalies: []
            },
            analyzer: { hasAnomalies: false, anomalies: [], confidence: 0 },
            interventionScore: 0.1,
            physicsUnabated: true,
            notes: []
        };
    }

    it('appends and reads recent from disk', () => {
        store.append(sheet('alpha', 'r1'));
        store.append(sheet('alpha', 'r2'));
        const recent = store.readRecentFromDisk('alpha', 10);
        expect(recent).toHaveLength(2);
        expect(recent[0]!.runId).toBe('r1');
        expect(recent[1]!.runId).toBe('r2');
    });

    it('keeps in-memory tail', () => {
        store.append(sheet('beta', 'a'));
        store.append(sheet('beta', 'b'));
        expect(store.getLastInMemory('beta')?.runId).toBe('b');
        expect(store.getRecentInMemory('beta', 1).map((s) => s.runId)).toEqual(['b']);
    });
});
