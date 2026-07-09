// KPI · CPA — Cost Per Acquisition
import { classify, nowIso, safeDivide, type KpiResult } from "./types";
export type CpaInputs = { adSpendCents: number; conversions: number };
export function cpa(input: CpaInputs): KpiResult<CpaInputs> {
  const { value, warning } = safeDivide(input.adSpendCents, input.conversions);
  return {
    kpi: "cpa", value, unit: "currency_cents",
    formula: "adSpend / conversions",
    inputs: input,
    severity: classify(value, { ok: 5000_00, warn: 15000_00, risk: 40000_00 }, "lower_is_better"),
    warnings: warning ? [warning] : [],
    computedAt: nowIso(),
  };
}
