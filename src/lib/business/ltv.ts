// KPI · LTV — Lifetime Value (ARPU × margem / churn)
import { classify, nowIso, safeDivide, type KpiResult } from "./types";

export type LtvInputs = { arpuCents: number; grossMargin: number; churnRate: number };

export function ltv(input: LtvInputs): KpiResult<LtvInputs> {
  const gross = input.arpuCents * input.grossMargin;
  const { value, warning } = safeDivide(gross, input.churnRate);
  return {
    kpi: "ltv", value, unit: "currency_cents",
    formula: "arpuCents * grossMargin / churnRate",
    inputs: input,
    severity: classify(value, { ok: 100_000_00, warn: 30_000_00, risk: 10_000_00 }, "higher_is_better"),
    warnings: warning ? [warning] : [],
    computedAt: nowIso(),
  };
}
