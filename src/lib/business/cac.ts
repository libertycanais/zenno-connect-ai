// KPI · CAC — Customer Acquisition Cost
import { classify, nowIso, safeDivide, type KpiResult } from "./types";

export type CacInputs = { totalAcquisitionCostCents: number; newCustomers: number };

export function cac(input: CacInputs): KpiResult<CacInputs> {
  const { value, warning } = safeDivide(input.totalAcquisitionCostCents, input.newCustomers);
  return {
    kpi: "cac", value, unit: "currency_cents",
    formula: "totalAcquisitionCostCents / newCustomers",
    inputs: input,
    severity: classify(value, { ok: 5000_00, warn: 15000_00, risk: 30000_00 }, "lower_is_better"),
    warnings: warning ? [warning] : [],
    computedAt: nowIso(),
  };
}
