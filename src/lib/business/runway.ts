// KPI · Runway (meses)
import { classify, nowIso, safeDivide, type KpiResult } from "./types";
export type RunwayInputs = { cashCents: number; monthlyBurnCents: number };
export function runway(input: RunwayInputs): KpiResult<RunwayInputs> {
  if (input.monthlyBurnCents <= 0) {
    return {
      kpi: "runway", value: Number.POSITIVE_INFINITY, unit: "months",
      formula: "cash / monthlyBurn",
      inputs: input, severity: "ok", warnings: [],
      computedAt: nowIso(),
    };
  }
  const { value, warning } = safeDivide(input.cashCents, input.monthlyBurnCents);
  return {
    kpi: "runway", value, unit: "months",
    formula: "cash / monthlyBurn", inputs: input,
    severity: classify(value, { ok: 18, warn: 9, risk: 3 }, "higher_is_better"),
    warnings: warning ? [warning] : [], computedAt: nowIso(),
  };
}
