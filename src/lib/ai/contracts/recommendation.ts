// EPIC A — Zenno Brain · Recommendation contracts (surface only)
import type { RecommendationScoreBreakdown } from "../governance/types";

export type RecommendationKind =
  | "budget" | "creative" | "audience" | "cro" | "seo"
  | "growth" | "churn" | "forecast" | "risk";

export type Recommendation = {
  recommendationId: string;
  organizationId: string;
  kind: RecommendationKind;
  title: string;
  rationale: string;
  score: RecommendationScoreBreakdown;
  actions: Array<{ label: string; kind: string; payload: Record<string, unknown> }>;
  createdAt: string;
  createdFromPlanId: string | null;
};
