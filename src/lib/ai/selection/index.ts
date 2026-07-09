// FEATURE P0.6 — Onda 3 · Model Selection Engine
// Deterministic scoring. Callers never pick provider/model directly — always
// route through `selectModel()`. When user chooses "auto", the engine ranks by
// capability fit, cost, budget, health, and benchmark.

import type { ProviderBenchmarkSnapshot } from "../benchmark";
import type { HealthSnapshot } from "../health";
import type { ModelDescriptor, ProviderDescriptor, ProviderRegistry } from "../registry";

export type SelectionRequirements = {
  approxInputTokens: number;
  approxOutputTokens: number;
  needsStreaming?: boolean;
  needsJson?: boolean;
  needsTools?: boolean;
  needsVision?: boolean;
  needsReasoning?: boolean;
  taskKind: "chat" | "analysis" | "summary" | "extraction" | "reasoning" | "vision";
  remainingBudgetCents?: number;
};

export type SelectionInput = {
  registry: ProviderRegistry;
  mode: { kind: "auto" } | { kind: "explicit"; providerId: string; modelId: string };
  requirements: SelectionRequirements;
  benchmarks?: Map<string, ProviderBenchmarkSnapshot>;
  health?: Map<string, HealthSnapshot>;
};

export type SelectionCandidate = {
  provider: ProviderDescriptor;
  model: ModelDescriptor;
  estimatedCostCents: number;
  score: number;
  reasons: string[];
};

export type SelectionResult =
  | { ok: true; chosen: SelectionCandidate; ranked: SelectionCandidate[] }
  | { ok: false; reason: string };

const key = (providerId: string, modelId: string) => `${providerId}:${modelId}`;

export function estimateCostCents(model: ModelDescriptor, inTok: number, outTok: number): number {
  const cents =
    (inTok / 1_000_000) * model.costInputPerMTokCents +
    (outTok / 1_000_000) * model.costOutputPerMTokCents;
  return Math.max(1, Math.round(cents));
}

function capable(model: ModelDescriptor, req: SelectionRequirements): boolean {
  if (req.needsStreaming && !model.supportsStreaming) return false;
  if (req.needsJson && !model.supportsJson) return false;
  if (req.needsTools && !model.supportsTools) return false;
  if (req.needsVision && !model.supportsVision) return false;
  if (req.needsReasoning && !model.supportsReasoning) return false;
  if (req.approxInputTokens + req.approxOutputTokens > model.maxContext) return false;
  return true;
}

export function selectModel(input: SelectionInput): SelectionResult {
  const { registry, mode, requirements } = input;

  if (mode.kind === "explicit") {
    const provider = registry.get(mode.providerId);
    const model = registry.findModel(mode.providerId, mode.modelId);
    if (!provider || !model) return { ok: false, reason: "MODEL_UNKNOWN" };
    if (!capable(model, requirements)) return { ok: false, reason: "MODEL_INCAPABLE" };
    if (provider.status === "offline") return { ok: false, reason: "PROVIDER_OFFLINE" };
    const cost = estimateCostCents(model, requirements.approxInputTokens, requirements.approxOutputTokens);
    if (requirements.remainingBudgetCents !== undefined && cost > requirements.remainingBudgetCents)
      return { ok: false, reason: "BUDGET_EXCEEDED" };
    return {
      ok: true,
      chosen: { provider, model, estimatedCostCents: cost, score: 1, reasons: ["explicit"] },
      ranked: [],
    };
  }

  const all = registry.allModels();
  const candidates: SelectionCandidate[] = [];
  for (const { provider, model } of all) {
    if (provider.status === "offline") continue;
    if (!capable(model, requirements)) continue;
    const estimatedCostCents = estimateCostCents(
      model,
      requirements.approxInputTokens,
      requirements.approxOutputTokens,
    );
    if (requirements.remainingBudgetCents !== undefined && estimatedCostCents > requirements.remainingBudgetCents)
      continue;

    const reasons: string[] = [];
    let score = 0;

    // Capability match — reasoning tasks favor reasoning-capable models
    if (requirements.taskKind === "reasoning" && model.supportsReasoning) {
      score += 30;
      reasons.push("reasoning_match");
    }
    if (requirements.taskKind === "vision" && model.supportsVision) {
      score += 25;
      reasons.push("vision_match");
    }
    if (requirements.taskKind === "extraction" && model.supportsJson) {
      score += 10;
      reasons.push("json_match");
    }

    // Cost bias (cheaper wins, up to +40)
    const costPenalty = Math.min(40, estimatedCostCents / 5);
    score -= costPenalty;
    reasons.push(`cost=${estimatedCostCents}c`);

    // Provider + model priority
    score += model.priority * 0.4 + provider.priority * 0.2;

    // Health penalty
    const health = input.health?.get(provider.providerId);
    if (health) {
      if (health.status === "degraded") { score -= 15; reasons.push("degraded"); }
      if (health.uptime01 < 0.95) { score -= 10; reasons.push("low_uptime"); }
    }

    // Benchmark bonus (lower latency, lower error)
    const bench = input.benchmarks?.get(key(provider.providerId, model.id));
    if (bench) {
      if (bench.p50LatencyMs > 0) score -= Math.min(15, bench.p50LatencyMs / 500);
      score -= Math.min(20, bench.errorRate01 * 40);
      reasons.push(`bench:p50=${bench.p50LatencyMs}ms,err=${(bench.errorRate01 * 100).toFixed(1)}%`);
    }

    candidates.push({ provider, model, estimatedCostCents, score, reasons });
  }

  if (candidates.length === 0) return { ok: false, reason: "NO_CANDIDATES" };
  candidates.sort((a, b) => b.score - a.score);
  return { ok: true, chosen: candidates[0]!, ranked: candidates };
}
