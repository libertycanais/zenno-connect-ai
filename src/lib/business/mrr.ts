// KPI · MRR — Monthly Recurring Revenue
import { classify, nowIso, type KpiResult } from "./types";
export type MrrInputs = { activeSubscriptionCentsPerMonth: number[] };
export function mrr(input: MrrInputs): KpiResult<{ subs: number; totalCents: number }> {
  const totalCents = input.activeSubscriptionCentsPerMonth.reduce((s, v) => s + (Number.isFinite(v) ? v : 0), 0);
  return {
    kpi: "mrr", value: totalCents, unit: "currency_cents",
    formula: "sum(activeSubscriptionCentsPerMonth)",
    inputs: { subs: input.activeSubscriptionCentsPerMonth.length, totalCents },
    severity: classify(totalCents, { ok: 100_000_00, warn: 20_000_00, risk: 5_000_00 }, "higher_is_better"),
    warnings: [],
    computedAt: nowIso(),
  };
}
