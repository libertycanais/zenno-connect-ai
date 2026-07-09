// KPI · ARPU — Average Revenue per User
import { classify, nowIso, safeDivide, type KpiResult } from "./types";
export type ArpuInputs = { revenueCents: number; users: number };
export function arpu(input: ArpuInputs): KpiResult<ArpuInputs> {
  const { value, warning } = safeDivide(input.revenueCents, input.users);
  return {
    kpi: "arpu", value, unit: "currency_cents",
    formula: "revenue / users", inputs: input,
    severity: classify(value, { ok: 300_00, warn: 100_00, risk: 30_00 }, "higher_is_better"),
    warnings: warning ? [warning] : [], computedAt: nowIso(),
  };
}
