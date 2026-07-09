// KPI · CPM — Cost per Mille
import { classify, nowIso, safeDivide, type KpiResult } from "./types";
export type CpmInputs = { adSpendCents: number; impressions: number };
export function cpm(input: CpmInputs): KpiResult<CpmInputs> {
  const { value, warning } = safeDivide(input.adSpendCents * 1000, input.impressions);
  return {
    kpi: "cpm", value, unit: "currency_cents",
    formula: "adSpend * 1000 / impressions",
    inputs: input,
    severity: classify(value, { ok: 2000, warn: 5000, risk: 10000 }, "lower_is_better"),
    warnings: warning ? [warning] : [],
    computedAt: nowIso(),
  };
}
