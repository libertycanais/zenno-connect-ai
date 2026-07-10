// FEATURE — Marketing Intelligence · Executive Summary builder
import type {
  ExecutiveSummary, IntelligenceRecommendation, MarketingHealthReport,
} from "../types";
import type { MarketingProvider } from "../../contracts/assets";

export function buildExecutiveSummary(input: {
  organizationId: string;
  provider: MarketingProvider;
  health: MarketingHealthReport;
  recommendations: IntelligenceRecommendation[];
}): ExecutiveSummary {
  const { organizationId, provider, health, recommendations } = input;
  const sorted = [...recommendations].sort((a, b) => b.financialValueCents - a.financialValueCents);
  const opportunity = sorted.find((r) => r.priority === "high" || r.priority === "critical") ?? sorted[0] ?? null;
  const risk = recommendations.find((r) => r.priority === "critical") ?? null;
  const roi = recommendations.reduce((s, r) => s + Math.max(0, r.financialValueCents), 0);
  const impact = roi;
  const priority: ExecutiveSummary["priority"] =
    risk ? "critical" : opportunity?.priority ?? (health.severity === "critical" ? "high" : "medium");
  const confidence = recommendations.length
    ? recommendations.reduce((s, r) => s + r.confidence, 0) / recommendations.length
    : 0.5;
  const sources = Array.from(new Set(recommendations.flatMap((r) => r.sources)));
  const summary = health.severity === "excellent"
    ? "Sua conta está saudável. Foco em escalar oportunidades."
    : health.severity === "good"
    ? "Conta saudável com pontos de otimização identificados."
    : health.severity === "attention"
    ? "Sinais de atenção detectados; recomendamos ação prioritária."
    : "Estado crítico. Intervenção imediata recomendada.";
  const nextSteps = sorted.slice(0, 3).map((r) => r.nextAction);
  return {
    organizationId, provider, summary,
    healthScore: health.overall,
    topOpportunity: opportunity?.recommendation ?? null,
    topRisk: risk?.problem ?? null,
    estimatedRoiCents: roi,
    financialImpactCents: impact,
    priority,
    nextSteps,
    confidence,
    sources,
    generatedAt: new Date().toISOString(),
  };
}
