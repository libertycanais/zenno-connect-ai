// KPI · Burn Rate (mensal)
import { classify, nowIso, type KpiResult } from "./types";
export type BurnInputs = { monthlyExpensesCents: number; monthlyRevenueCents: number };
export function burn(input: BurnInputs): KpiResult<BurnInputs> {
  const value = input.monthlyExpensesCents - input.monthlyRevenueCents;
  return {
    kpi: "burn", value, unit: "currency_cents",
    formula: "expenses - revenue", inputs: input,
    severity: classify(value, { ok: 0, warn: 50_000_00, risk: 200_000_00 }, "lower_is_better"),
    warnings: [], computedAt: nowIso(),
  };
}
