import type { EntangledBECZone } from './ger-bec-ring-toy';

export interface FoodTeleportBecCostInput {
    separation_m: number;
    /** 0–1; higher tunneling probability reads as an easier path and lowers BEC draw (simulation). */
    tunnelingProbability: number;
    target: 'fruit' | 'meat';
}

/**
 * Toy GER energy units (bigint) drawn from a registered BEC ring buffer to “fund” anchored food teleportation.
 * Values stay well below Number.MAX_SAFE_INTEGER for `triggerDischarge(zoneId, Number(cost))`.
 */
export function computeFoodTeleportBecCost(input: FoodTeleportBecCostInput): bigint {
    const sep = Math.min(Math.max(0, input.separation_m), 50_000);
    const tprob = Math.min(1, Math.max(0, input.tunnelingProbability));
    const base = 5_000n;
    const sepPart = BigInt(Math.ceil(sep)) * 30n;
    const barrierHardness = BigInt(Math.round((1 - tprob) * 75_000));
    let cost = base + sepPart + barrierHardness;
    if (input.target === 'meat') {
        cost = (cost * 11n) / 10n;
    }
    return cost;
}

export function precheckBecFundingForFoodTeleport(
    becZoneId: string,
    zone: EntangledBECZone | undefined,
    cost: bigint
):
    | { ok: true; zone: EntangledBECZone }
    | { ok: false; status: 404; body: Record<string, unknown> }
    | { ok: false; status: 422; body: Record<string, unknown> } {
    if (!zone) {
        return {
            ok: false,
            status: 404,
            body: {
                error: 'bec zone not registered',
                simulation: true,
                becZoneId
            }
        };
    }
    if (zone.buffer.currentLoad < cost) {
        return {
            ok: false,
            status: 422,
            body: {
                error: 'insufficient BEC buffer for anchored food teleport',
                simulation: true,
                becZoneId,
                requiredCost: cost.toString(),
                currentLoad: zone.buffer.currentLoad.toString()
            }
        };
    }
    return { ok: true, zone };
}
