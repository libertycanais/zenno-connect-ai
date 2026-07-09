// KPI · Business Health Score (compõe outros KPIs em nota 0-100)
import { classify, nowIso, type KpiResult } from "./types";
import { computeScore, type ScoreComponent } from "./scoring";

export type HealthScoreInputs = {
  roas: number | null;
  roi: number | null;
  cac: number | null;
  ltv: number | null;
  ctr: number | null;
  conversionRate: number | null;
  trackingCoverage: number | null;   // 0..1 quantos eventos essenciais estão presentes
  dataQuality: number | null;        // 0..1 completude
  budgetUtilization: number | null;  // 0..1
  historyMonths: number | null;
};

export function healthScore(input: HealthScoreInputs): KpiResult<HealthScoreInputs> & { components: ScoreComponent[] } {
  const components: ScoreComponent[] = [
    { name: "roas",              weight: 0.18, score: normalize(input.roas, 1, 6) },
    { name: "roi",               weight: 0.12, score: normalize(input.roi, 0, 2) },
    { name: "cac_efficiency",    weight: 0.10, score: normalizeInverse(input.cac, 5_000_00, 40_000_00) },
    { name: "ltv_cac",           weight: 0.10, score: ltvOverCac(input.ltv, input.cac) },
    { name: "ctr",               weight: 0.08, score: normalize(input.ctr, 0.005, 0.03) },
    { name: "conversion_rate",   weight: 0.10, score: normalize(input.conversionRate, 0.01, 0.05) },
    { name: "tracking_coverage", weight: 0.10, score: input.trackingCoverage ?? 0 },
    { name: "data_quality",      weight: 0.10, score: input.dataQuality ?? 0 },
    { name: "budget_utilization",weight: 0.07, score: budgetHealth(input.budgetUtilization) },
    { name: "history",           weight: 0.05, score: normalize(input.historyMonths, 1, 6) },
  ];
  const score = Math.round(computeScore(components) * 100);
  return {
    kpi: "health_score", value: score, unit: "score",
    formula: "weighted average of 10 components (see components)",
    inputs: input,
    severity: classify(score, { ok: 75, warn: 55, risk: 40 }, "higher_is_better"),
    warnings: components.filter((c) => c.score === 0).map((c) => ({
      code: "MISSING_COMPONENT", message: `Componente sem dado: ${c.name}`,
    })),
    computedAt: nowIso(),
    components,
  };
}

function normalize(value: number | null, min: number, max: number): number {
  if (value === null || !Number.isFinite(value)) return 0;
  if (value <= min) return 0;
  if (value >= max) return 1;
  return (value - min) / (max - min);
}
function normalizeInverse(value: number | null, best: number, worst: number): number {
  if (value === null || !Number.isFinite(value)) return 0;
  if (value <= best) return 1;
  if (value >= worst) return 0;
  return 1 - (value - best) / (worst - best);
}
function ltvOverCac(ltv: number | null, cac: number | null): number {
  if (ltv === null || cac === null || cac <= 0) return 0;
  const ratio = ltv / cac;
  return normalize(ratio, 1, 5);
}
function budgetHealth(u: number | null): number {
  if (u === null || !Number.isFinite(u)) return 0;
  // sweet-spot 60..90%
  if (u < 0.4) return 0.5;
  if (u <= 0.9) return 1;
  if (u <= 1.1) return 0.7;
  return 0.3;
}
