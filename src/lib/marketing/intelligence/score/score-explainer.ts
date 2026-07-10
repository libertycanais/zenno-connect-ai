// FEATURE — First Five Minutes · Score Explainer (additive)
// "A IA deve sempre explicar. Nunca apenas mostrar nota."
// Turns an IntelligenceScoreResult into plain-language sentences.
import type { IntelligenceScoreResult } from "./intelligence-score";

export type ScoreExplanation = {
  headline: string;   // "Excelente estrutura de marketing."
  detail: string;     // "Nenhum problema crítico encontrado."
  reasons: string[];  // bullets like "Tracking: 96/100"
};

const HEADLINES: Record<IntelligenceScoreResult["grade"], string> = {
  Enterprise: "Excelente estrutura de marketing.",
  Advanced: "Marketing bem estruturado, com margem para otimizações.",
  Growing: "Base sólida, mas há pontos importantes para melhorar.",
  Foundational: "Estrutura ainda em formação — priorize os fundamentos.",
};

function label(dim: string): string {
  switch (dim) {
    case "health": return "Saúde geral";
    case "readiness": return "Prontidão para IA";
    case "recommendations": return "Riscos ativos";
    case "tracking": return "Rastreamento";
    case "budget": return "Orçamento";
    case "conversion": return "Conversão";
    default: return dim;
  }
}

function describeDetail(risks: number, opportunities: number): string {
  if (risks === 0 && opportunities === 0) return "Nenhum problema crítico encontrado.";
  if (risks === 0) return `${opportunities} oportunidade${opportunities === 1 ? "" : "s"} de otimização identificada${opportunities === 1 ? "" : "s"}.`;
  if (opportunities === 0) return `${risks} risco${risks === 1 ? "" : "s"} requer${risks === 1 ? "" : "em"} atenção.`;
  return `${risks} risco${risks === 1 ? "" : "s"} e ${opportunities} oportunidade${opportunities === 1 ? "" : "s"} identificado${opportunities === 1 ? "" : "s"}.`;
}

export function explainIntelligenceScore(
  score: IntelligenceScoreResult,
  counts: { risksCount: number; opportunitiesCount: number },
): ScoreExplanation {
  const entries = Object.entries(score.breakdown) as Array<[keyof typeof score.breakdown, number]>;
  // 3 lowest components → most actionable reasons
  const reasons = entries
    .slice()
    .sort((a, b) => a[1] - b[1])
    .slice(0, 3)
    .map(([k, v]) => `${label(k)}: ${Math.round(v)}/100`);

  return {
    headline: HEADLINES[score.grade],
    detail: describeDetail(counts.risksCount, counts.opportunitiesCount),
    reasons,
  };
}
