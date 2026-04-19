import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

export interface QuantumPythonResult<T = unknown> {
    ok: boolean;
    result?: T;
    error?: string;
}

const DEFAULT_TIMEOUT_MS = 15000;

function resolveCliPath(): string {
    const envPath = process.env.QUANTUM_PYTHON_CLI;
    if (envPath && fs.existsSync(envPath)) {
        return envPath;
    }
    return path.join(__dirname, '../../python/quantum_geo/cli.py');
}

function resolvePythonBin(): string {
    return process.env.QUANTUM_PYTHON_BIN || 'python3';
}

/**
 * Runs the quantum_geo JSON CLI (numpy/scipy). Returns parsed JSON or throws on hard failure.
 */
export async function runQuantumPython<T = unknown>(
    payload: Record<string, unknown>,
    timeoutMs: number = DEFAULT_TIMEOUT_MS
): Promise<QuantumPythonResult<T>> {
    const python = resolvePythonBin();
    const cli = resolveCliPath();
    if (!fs.existsSync(cli)) {
        return { ok: false, error: `quantum_geo cli not found at ${cli}` };
    }

    return new Promise((resolve) => {
        const proc = spawn(python, [cli], {
            stdio: ['pipe', 'pipe', 'pipe']
        });
        let stdout = '';
        let stderr = '';
        const timer = setTimeout(() => {
            proc.kill('SIGKILL');
            resolve({ ok: false, error: `quantum python timeout after ${timeoutMs}ms` });
        }, timeoutMs);

        proc.stdout.on('data', (d: Buffer) => {
            stdout += d.toString();
        });
        proc.stderr.on('data', (d: Buffer) => {
            stderr += d.toString();
        });
        proc.on('error', (err) => {
            clearTimeout(timer);
            resolve({ ok: false, error: err.message });
        });
        proc.on('close', (code) => {
            clearTimeout(timer);
            if (code !== 0 && !stdout) {
                resolve({ ok: false, error: stderr || `python exited ${code}` });
                return;
            }
            try {
                const parsed = JSON.parse(stdout) as QuantumPythonResult<T>;
                if (!parsed.ok && stderr) {
                    parsed.error = `${parsed.error || ''} ${stderr}`.trim();
                }
                resolve(parsed);
            } catch {
                resolve({ ok: false, error: `invalid json: ${stdout.slice(0, 200)} ${stderr}` });
            }
        });

        proc.stdin.write(JSON.stringify(payload));
        proc.stdin.end();
    });
}
