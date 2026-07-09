// KPI · ROAS — Return on Ad Spend
import { classify, nowIso, safeDivide, type KpiResult } from "./types";
export type RoasInputs = { revenueCents: number; adSpendCents: number };
export function roas(input: RoasInputs): KpiResult<RoasInputs> {
  const { value, warning } = safeDivide(input.revenueCents, input.adSpendCents);
  return {
    kpi: "roas", value, unit: "ratio",
    formula: "revenue / adSpend",
    inputs: input,
    severity: classify(value, { ok: 4, warn: 2, risk: 1 }, "higher_is_better"),
    warnings: warning ? [warning] : [],
    computedAt: nowIso(),
  };
}
