// KPI · ARR — Annual Recurring Revenue
import { classify, nowIso, type KpiResult } from "./types";
export type ArrInputs = { mrrCents: number };
export function arr(input: ArrInputs): KpiResult<ArrInputs> {
  const value = input.mrrCents * 12;
  return {
    kpi: "arr", value, unit: "currency_cents",
    formula: "mrr * 12", inputs: input,
    severity: classify(value, { ok: 1_200_000_00, warn: 240_000_00, risk: 60_000_00 }, "higher_is_better"),
    warnings: [], computedAt: nowIso(),
  };
}
