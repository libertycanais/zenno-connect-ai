// EPIC I — Executive KPI aggregation utilities (pure)
import type { ExecutiveKpiSnapshot, ExecutiveSeverity } from "../executive/types";

export function classifyKpi(value: number | null, thresholds: { ok: number; warn: number }, higherIsBetter = true): ExecutiveSeverity {
  if (value === null || !Number.isFinite(value)) return "warn";
  if (higherIsBetter) {
    if (value >= thresholds.ok) return "info";
    if (value >= thresholds.warn) return "warn";
    return "critical";
  }
  if (value <= thresholds.ok) return "info";
  if (value <= thresholds.warn) return "warn";
  return "critical";
}

export function aggregateBySeverity(kpis: ExecutiveKpiSnapshot[]): Record<ExecutiveSeverity, number> {
  const out = { info: 0, warn: 0, critical: 0 };
  for (const k of kpis) out[k.severity] += 1;
  return out;
}
