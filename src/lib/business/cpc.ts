// KPI · CPC — Cost per Click
import { classify, nowIso, safeDivide, type KpiResult } from "./types";
export type CpcInputs = { adSpendCents: number; clicks: number };
export function cpc(input: CpcInputs): KpiResult<CpcInputs> {
  const { value, warning } = safeDivide(input.adSpendCents, input.clicks);
  return {
    kpi: "cpc", value, unit: "currency_cents",
    formula: "adSpend / clicks",
    inputs: input,
    severity: classify(value, { ok: 200_00, warn: 500_00, risk: 1500_00 }, "lower_is_better"),
    warnings: warning ? [warning] : [],
    computedAt: nowIso(),
  };
}
