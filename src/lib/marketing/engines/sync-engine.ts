// FEATURE — Marketing Platform · Intelligent Sync Engine
// Tier-based scheduling. Pure planner + optional executor via connector.

import type { AssetKind, PlatformAsset } from "../contracts/assets";
import type { ConnectorTokens, SyncResult } from "../contracts/connector";
import { policyFor, computeNextRun, type SyncTier } from "../contracts/sync";
import { getConnector } from "../registry/connector-registry";

export type SyncPlanEntry = {
  assetKind: AssetKind;
  externalId: string;
  tier: SyncTier;
  nextRunAt: string;
};

export function planSync(assets: PlatformAsset[], now: Date = new Date()): SyncPlanEntry[] {
  return assets.map((a) => {
    const p = policyFor(a.kind);
    const { nextRunAt } = computeNextRun(now, p, 0);
    return { assetKind: a.kind, externalId: a.externalId, tier: p.tier, nextRunAt: nextRunAt.toISOString() };
  });
}

export async function runSyncForAsset(
  asset: PlatformAsset,
  tokens: ConnectorTokens,
): Promise<{ ok: true; result: SyncResult } | { ok: false; error: string }> {
  try {
    const connector = getConnector(asset.provider);
    const result = await connector.syncAsset(tokens, asset);
    return { ok: true, result };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
