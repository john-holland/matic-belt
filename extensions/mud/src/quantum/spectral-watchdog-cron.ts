import cron from 'node-cron';
import type { SpectralWatchdog } from './spectral-watchdog';

/**
 * Schedules periodic re-evaluation of the last stored sheet per sector.
 * `SPECTRAL_WATCHDOG_CRON`: empty = disabled (simulation policy env vars, not OS scheduling guarantees).
 * `SPECTRAL_WATCHDOG_SECTORS`: comma-separated sector ids (e.g. mining volumes).
 */
export function startSpectralWatchdogCronIfEnabled(watchdog: SpectralWatchdog): { stop: () => void } {
    const expr = (process.env.SPECTRAL_WATCHDOG_CRON || '').trim();
    if (!expr) {
        return { stop: () => {} };
    }

    const sectors = (process.env.SPECTRAL_WATCHDOG_SECTORS || '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

    try {
        const task = cron.schedule(expr, () => {
            for (const sectorId of sectors) {
                void watchdog
                    .reEvaluateLastRunForSector(sectorId)
                    .catch((err: unknown) =>
                        console.error('[spectral-watchdog-cron]', sectorId, err)
                    );
            }
        });
        return {
            stop: () => {
                task.stop();
            }
        };
    } catch (e) {
        console.error('[spectral-watchdog-cron] invalid SPECTRAL_WATCHDOG_CRON', e);
        return { stop: () => {} };
    }
}
