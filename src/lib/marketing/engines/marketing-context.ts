// FEATURE — Marketing Platform · AI Marketing Context builder
// Additive slice consumable by AI Context Engine. Does NOT alter existing contracts.

import type { MarketingProvider } from "../contracts/assets";

export type MarketingContextEntry = {
  provider: MarketingProvider;
  connectedAt: string;
  assetCount: number;
  healthScore: number;
  boundAssets: Array<{ kind: string; name: string; externalId: string }>;
};

export type MarketingSlice = {
  connectedProviders: MarketingProvider[];
  overallHealth: number;
  entries: MarketingContextEntry[];
  generatedAt: string;
};

export function buildEmptySlice(): MarketingSlice {
  return { connectedProviders: [], overallHealth: 0, entries: [], generatedAt: new Date().toISOString() };
}

export function buildSlice(entries: MarketingContextEntry[]): MarketingSlice {
  const providers = Array.from(new Set(entries.map((e) => e.provider)));
  const overall = entries.length
    ? Math.round(entries.reduce((s, e) => s + e.healthScore, 0) / entries.length)
    : 0;
  return {
    connectedProviders: providers,
    overallHealth: overall,
    entries,
    generatedAt: new Date().toISOString(),
  };
}
