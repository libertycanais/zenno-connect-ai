// KPI · Ticket Médio
import { classify, nowIso, safeDivide, type KpiResult } from "./types";
export type TicketInputs = { revenueCents: number; orders: number };
export function ticket(input: TicketInputs): KpiResult<TicketInputs> {
  const { value, warning } = safeDivide(input.revenueCents, input.orders);
  return {
    kpi: "ticket", value, unit: "currency_cents",
    formula: "revenue / orders", inputs: input,
    severity: classify(value, { ok: 300_00, warn: 100_00, risk: 30_00 }, "higher_is_better"),
    warnings: warning ? [warning] : [], computedAt: nowIso(),
  };
}
