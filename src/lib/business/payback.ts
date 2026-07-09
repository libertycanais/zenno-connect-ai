// KPI · Payback Period (meses)
import { classify, nowIso, safeDivide, type KpiResult } from "./types";
export type PaybackInputs = { cacCents: number; monthlyRevenuePerCustomerCents: number; grossMargin: number };
export function payback(input: PaybackInputs): KpiResult<PaybackInputs> {
  const monthly = input.monthlyRevenuePerCustomerCents * input.grossMargin;
  const { value, warning } = safeDivide(input.cacCents, monthly);
  return {
    kpi: "payback", value, unit: "months",
    formula: "cac / (monthlyRevenuePerCustomer * grossMargin)",
    inputs: input,
    severity: classify(value, { ok: 6, warn: 12, risk: 24 }, "lower_is_better"),
    warnings: warning ? [warning] : [], computedAt: nowIso(),
  };
}
