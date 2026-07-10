// FEATURE — Marketing Intelligence · Context Updater
// Bridges pipeline output into the Marketing Context slice consumed by AI.
import { buildSlice, type MarketingSlice, type MarketingContextEntry } from "../../engines/marketing-context";
import type { PipelineResult } from "../types";

const memo = new Map<string, MarketingSlice>();

function key(orgId: string): string {
  return `mkt-ctx:${orgId}`;
}

export function updateMarketingContext(result: PipelineResult): MarketingSlice {
  const entry: MarketingContextEntry = {
    provider: result.provider,
    connectedAt: result.completedAt,
    assetCount: result.metrics.campaignsAnalyzed,
    healthScore: result.health.overall,
    boundAssets: [],
  };
  const existing = memo.get(key(result.organizationId));
  const entries = existing
    ? [...existing.entries.filter((e) => e.provider !== result.provider), entry]
    : [entry];
  const slice = buildSlice(entries);
  memo.set(key(result.organizationId), slice);
  return slice;
}

export function getMarketingContext(organizationId: string): MarketingSlice | undefined {
  return memo.get(key(organizationId));
}

export function clearMarketingContext(organizationId?: string): void {
  if (organizationId) memo.delete(key(organizationId));
  else memo.clear();
}
