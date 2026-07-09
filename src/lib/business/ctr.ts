// KPI · CTR — Click Through Rate
import { classify, nowIso, safeDivide, type KpiResult } from "./types";
export type CtrInputs = { clicks: number; impressions: number };
export function ctr(input: CtrInputs): KpiResult<CtrInputs> {
  const { value, warning } = safeDivide(input.clicks, input.impressions);
  return {
    kpi: "ctr", value, unit: "ratio",
    formula: "clicks / impressions",
    inputs: input,
    severity: classify(value, { ok: 0.02, warn: 0.01, risk: 0.005 }, "higher_is_better"),
    warnings: warning ? [warning] : [],
    computedAt: nowIso(),
  };
}
