// KPI · Retention Rate
import { classify, nowIso, safeDivide, type KpiResult } from "./types";
export type RetentionInputs = { retained: number; initialCohort: number };
export function retention(input: RetentionInputs): KpiResult<RetentionInputs> {
  const { value, warning } = safeDivide(input.retained, input.initialCohort);
  return {
    kpi: "retention", value, unit: "ratio",
    formula: "retained / initialCohort", inputs: input,
    severity: classify(value, { ok: 0.9, warn: 0.7, risk: 0.5 }, "higher_is_better"),
    warnings: warning ? [warning] : [], computedAt: nowIso(),
  };
}
