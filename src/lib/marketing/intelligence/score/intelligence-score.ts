// FEATURE — Marketing Intelligence Experience · Executive Score (0..100)
// Weighted composite. Used as the single number shown to CEOs.
// Weights sum to 1.0.
import type { MarketingHealthReport, AIReadinessReport, IntelligenceRecommendation } from "../types";

export type IntelligenceScoreInput = {
  health: MarketingHealthReport;
  readiness: AIReadinessReport;
  recommendations: IntelligenceRecommendation[];
};

export type IntelligenceScoreBreakdown = {
  health: number;
  readiness: number;
  recommendations: number;
  tracking: number;
  budget: number;
  conversion: number;
};

export type IntelligenceScoreResult = {
  score: number;                 // 0..100 (executive number)
  grade: "Enterprise" | "Advanced" | "Growing" | "Foundational";
  breakdown: IntelligenceScoreBreakdown;
  computedAt: string;
};

const WEIGHTS = {
  health: 0.30,
  readiness: 0.20,
  recommendations: 0.15,
  tracking: 0.10,
  budget: 0.10,
  conversion: 0.15,
} as const;

function componentScore(report: MarketingHealthReport, dim: string): number {
  return report.components.find((c) => c.dimension === dim)?.score ?? report.overall;
}

function recommendationScore(recs: IntelligenceRecommendation[]): number {
  if (recs.length === 0) return 90;
  const criticals = recs.filter((r) => r.priority === "critical").length;
  const highs = recs.filter((r) => r.priority === "high").length;
  const penalty = criticals * 18 + highs * 8;
  return Math.max(40, Math.min(100, 100 - penalty));
}

function grade(score: number): IntelligenceScoreResult["grade"] {
  if (score >= 90) return "Enterprise";
  if (score >= 75) return "Advanced";
  if (score >= 60) return "Growing";
  return "Foundational";
}

export function computeIntelligenceScore(input: IntelligenceScoreInput): IntelligenceScoreResult {
  const breakdown: IntelligenceScoreBreakdown = {
    health: input.health.overall,
    readiness: input.readiness.overall,
    recommendations: recommendationScore(input.recommendations),
    tracking: componentScore(input.health, "tracking"),
    budget: componentScore(input.health, "budget"),
    conversion: componentScore(input.health, "conversion"),
  };

  const weighted =
    breakdown.health * WEIGHTS.health +
    breakdown.readiness * WEIGHTS.readiness +
    breakdown.recommendations * WEIGHTS.recommendations +
    breakdown.tracking * WEIGHTS.tracking +
    breakdown.budget * WEIGHTS.budget +
    breakdown.conversion * WEIGHTS.conversion;

  const score = Math.round(Math.max(0, Math.min(100, weighted)));
  return { score, grade: grade(score), breakdown, computedAt: new Date().toISOString() };
}
