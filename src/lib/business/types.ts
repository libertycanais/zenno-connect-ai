// EPIC C — Business KPI Engine · Shared types
// Contract: KPIs são funções puras; retornam KpiResult com evidência
// suficiente para o Evidence Engine e para o Playbook Builder.

export type KpiSeverity = "ok" | "warn" | "risk" | "critical" | "unknown";

export type KpiWarning = {
  code: string;                 // e.g. "MISSING_INPUT", "DIVISION_BY_ZERO"
  message: string;
};

export type KpiResult<TInputs extends Record<string, number> = Record<string, number>> = {
  kpi: string;                  // canonical id (cac, ltv, roas...)
  value: number | null;         // null when computation is not possible
  unit: "currency_cents" | "ratio" | "percent" | "days" | "months" | "count" | "score";
  formula: string;              // human-readable formula used
  inputs: TInputs;              // exact numeric inputs that fed the formula
  severity: KpiSeverity;
  warnings: KpiWarning[];
  computedAt: string;           // ISO
};

export function nowIso(): string { return new Date().toISOString(); }

export function safeDivide(numerator: number, denominator: number): {
  value: number | null; warning: KpiWarning | null;
} {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator)) {
    return { value: null, warning: { code: "MISSING_INPUT", message: "Entrada não numérica" } };
  }
  if (denominator === 0) {
    return { value: null, warning: { code: "DIVISION_BY_ZERO", message: "Divisor igual a zero" } };
  }
  return { value: numerator / denominator, warning: null };
}

export function classify(
  value: number | null,
  thresholds: { ok: number; warn: number; risk: number },
  direction: "higher_is_better" | "lower_is_better",
): KpiSeverity {
  if (value === null || !Number.isFinite(value)) return "unknown";
  if (direction === "higher_is_better") {
    if (value >= thresholds.ok) return "ok";
    if (value >= thresholds.warn) return "warn";
    if (value >= thresholds.risk) return "risk";
    return "critical";
  }
  if (value <= thresholds.ok) return "ok";
  if (value <= thresholds.warn) return "warn";
  if (value <= thresholds.risk) return "risk";
  return "critical";
}
