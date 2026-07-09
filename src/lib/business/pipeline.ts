// KPI · Pipeline Weighted Value
import { classify, nowIso, type KpiResult } from "./types";
export type PipelineDeal = { valueCents: number; probability: number };
export type PipelineInputs = { deals: PipelineDeal[] };
export function pipeline(input: PipelineInputs): KpiResult<{ dealCount: number; weightedCents: number }> {
  const weighted = input.deals.reduce(
    (s, d) => s + (Number.isFinite(d.valueCents) ? d.valueCents : 0) * Math.max(0, Math.min(1, d.probability)),
    0,
  );
  return {
    kpi: "pipeline", value: weighted, unit: "currency_cents",
    formula: "sum(valueCents * probability)",
    inputs: { dealCount: input.deals.length, weightedCents: weighted },
    severity: classify(weighted, { ok: 500_000_00, warn: 100_000_00, risk: 20_000_00 }, "higher_is_better"),
    warnings: [], computedAt: nowIso(),
  };
}
