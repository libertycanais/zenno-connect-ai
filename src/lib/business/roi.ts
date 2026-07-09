// KPI · ROI — Return on Investment
import { classify, nowIso, safeDivide, type KpiResult } from "./types";
export type RoiInputs = { revenueCents: number; costCents: number };
export function roi(input: RoiInputs): KpiResult<RoiInputs> {
  const { value, warning } = safeDivide(input.revenueCents - input.costCents, input.costCents);
  return {
    kpi: "roi", value, unit: "ratio",
    formula: "(revenue - cost) / cost",
    inputs: input,
    severity: classify(value, { ok: 1, warn: 0.3, risk: 0 }, "higher_is_better"),
    warnings: warning ? [warning] : [],
    computedAt: nowIso(),
  };
}
