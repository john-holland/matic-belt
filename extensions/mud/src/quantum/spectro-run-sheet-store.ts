import * as fs from 'fs';
import * as path from 'path';
import type { SpectroRunDataSheet } from './spectral-run-types';

const DEFAULT_RELATIVE_DIR = 'data/spectral-runs';
const DEFAULT_FILE = 'runs.jsonl';
const TAIL_CACHE_MAX = 500;

function resolveRunsFile(): string {
    const dir = process.env.SPECTRAL_RUNS_DIR || path.join(process.cwd(), DEFAULT_RELATIVE_DIR);
    return path.join(dir, DEFAULT_FILE);
}

/**
 * Append-only JSONL persistence for spectral run sheets.
 */
export class SpectroRunSheetStore {
    private readonly filePath: string;
    /** sectorId -> last N sheets (newest at end). */
    private tailBySector = new Map<string, SpectroRunDataSheet[]>();

    constructor(filePath?: string) {
        this.filePath = filePath || resolveRunsFile();
    }

    getFilePath(): string {
        return this.filePath;
    }

    private ensureDir(): void {
        const dir = path.dirname(this.filePath);
        fs.mkdirSync(dir, { recursive: true });
    }

    append(sheet: SpectroRunDataSheet): void {
        this.ensureDir();
        fs.appendFileSync(this.filePath, `${JSON.stringify(sheet)}\n`, 'utf8');
        const list = this.tailBySector.get(sheet.sectorId) || [];
        list.push(sheet);
        while (list.length > TAIL_CACHE_MAX) list.shift();
        this.tailBySector.set(sheet.sectorId, list);
    }

    /** Last sheet for sector from memory cache (populated by append or loadTailFromDisk). */
    getLastInMemory(sectorId: string): SpectroRunDataSheet | null {
        const list = this.tailBySector.get(sectorId);
        if (!list?.length) return null;
        return list[list.length - 1] ?? null;
    }

    getRecentInMemory(sectorId: string, limit: number): SpectroRunDataSheet[] {
        const list = this.tailBySector.get(sectorId) || [];
        if (limit <= 0) return [];
        return list.slice(-limit);
    }

    /**
     * Load the last `maxLines` lines from disk into memory tails (for sectors present in those lines).
     */
    loadTailFromDisk(maxLines = 2000): void {
        if (!fs.existsSync(this.filePath)) return;
        const raw = fs.readFileSync(this.filePath, 'utf8');
        const lines = raw.split('\n').filter(Boolean);
        const slice = lines.slice(-maxLines);
        for (const line of slice) {
            try {
                const sheet = JSON.parse(line) as SpectroRunDataSheet;
                if (!sheet?.sectorId || !sheet.runId) continue;
                const list = this.tailBySector.get(sheet.sectorId) || [];
                list.push(sheet);
                while (list.length > TAIL_CACHE_MAX) list.shift();
                this.tailBySector.set(sheet.sectorId, list);
            } catch {
                /* skip bad line */
            }
        }
    }

    /** Read last `limit` sheets for a sector from disk (full scan; fine for simulation volumes). */
    readRecentFromDisk(sectorId: string, limit: number): SpectroRunDataSheet[] {
        if (!fs.existsSync(this.filePath) || limit <= 0) return [];
        const raw = fs.readFileSync(this.filePath, 'utf8');
        const out: SpectroRunDataSheet[] = [];
        const lines = raw.split('\n').filter(Boolean);
        for (let i = lines.length - 1; i >= 0 && out.length < limit; i--) {
            try {
                const sheet = JSON.parse(lines[i]!) as SpectroRunDataSheet;
                if (sheet.sectorId === sectorId) out.push(sheet);
            } catch {
                /* skip */
            }
        }
        return out.reverse();
    }
}
