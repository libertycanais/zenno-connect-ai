// KPI · Churn Rate
import { classify, nowIso, safeDivide, type KpiResult } from "./types";
export type ChurnInputs = { lost: number; initialCohort: number };
export function churn(input: ChurnInputs): KpiResult<ChurnInputs> {
  const { value, warning } = safeDivide(input.lost, input.initialCohort);
  return {
    kpi: "churn", value, unit: "ratio",
    formula: "lost / initialCohort", inputs: input,
    severity: classify(value, { ok: 0.02, warn: 0.05, risk: 0.10 }, "lower_is_better"),
    warnings: warning ? [warning] : [], computedAt: nowIso(),
  };
}
