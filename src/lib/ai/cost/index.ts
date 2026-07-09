// FEATURE P0.6 — Onda 3 · AI Cost Optimizer
// Pure math over Provider Registry. Never calls external APIs.

import type { ModelDescriptor, ProviderRegistry } from "../registry";
import { estimateCostCents } from "../selection";

export function estimateTokensFromText(text: string): number {
  // Coarse heuristic — ~4 chars/token. Not for billing; for planning only.
  return Math.max(1, Math.ceil(text.length / 4));
}

export type CostComparisonRow = {
  providerId: string;
  modelId: string;
  displayName: string;
  estimatedCostCents: number;
  costInputPerMTokCents: number;
  costOutputPerMTokCents: number;
};

export function compareModels(
  registry: ProviderRegistry,
  approxInputTokens: number,
  approxOutputTokens: number,
): CostComparisonRow[] {
  const rows: CostComparisonRow[] = registry.allModels().map(({ provider, model }) => ({
    providerId: provider.providerId,
    modelId: model.id,
    displayName: `${provider.displayName} · ${model.displayName}`,
    estimatedCostCents: estimateCostCents(model, approxInputTokens, approxOutputTokens),
    costInputPerMTokCents: model.costInputPerMTokCents,
    costOutputPerMTokCents: model.costOutputPerMTokCents,
  }));
  rows.sort((a, b) => a.estimatedCostCents - b.estimatedCostCents);
  return rows;
}

export type SavingsSuggestion = {
  from: { providerId: string; modelId: string; costCents: number };
  to: { providerId: string; modelId: string; costCents: number };
  savingsCents: number;
  savingsPct: number;
};

export function suggestCheaperAlternative(
  registry: ProviderRegistry,
  currentProviderId: string,
  currentModelId: string,
  approxInputTokens: number,
  approxOutputTokens: number,
  filter?: (m: ModelDescriptor) => boolean,
): SavingsSuggestion | null {
  const current = registry.findModel(currentProviderId, currentModelId);
  if (!current) return null;
  const currentCost = estimateCostCents(current, approxInputTokens, approxOutputTokens);
  const rows = compareModels(registry, approxInputTokens, approxOutputTokens).filter((r) => {
    const m = registry.findModel(r.providerId, r.modelId);
    return m && (!filter || filter(m)) && r.estimatedCostCents < currentCost;
  });
  const cheapest = rows[0];
  if (!cheapest) return null;
  const savings = currentCost - cheapest.estimatedCostCents;
  return {
    from: { providerId: currentProviderId, modelId: currentModelId, costCents: currentCost },
    to: { providerId: cheapest.providerId, modelId: cheapest.modelId, costCents: cheapest.estimatedCostCents },
    savingsCents: savings,
    savingsPct: currentCost > 0 ? (savings / currentCost) : 0,
  };
}
