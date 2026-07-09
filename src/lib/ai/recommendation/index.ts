// Recommendation Builder — Estrutura oficial de recomendações.
// Toda recomendação DEVE ter evidência + confiança + playbook opcional.

import type { EvidenceBundle } from "../evidence";
import type { Playbook } from "../playbooks";

export type RecommendationUrgency = "low" | "medium" | "high" | "critical";
export type RecommendationComplexity = "low" | "medium" | "high";

export type Recommendation = {
  recommendationId: string;
  organizationId: string;
  summary: string;              // resumo executivo curto
  diagnosis: string;            // interpretação técnica
  problem: string;
  impact: string;               // impacto no negócio (qualitativo)
  financialValueCents: number;  // impacto financeiro estimado (0 se desconhecido)
  urgency: RecommendationUrgency;
  complexity: RecommendationComplexity;
  checklist: Array<{ id: string; title: string; done: boolean }>;
  playbookId: string | null;
  evidenceId: string;
  confidence: number;           // 0..1 (derivado da evidência + regras)
  createdAt: string;
};

export type RecommendationInput = Omit<Recommendation, "recommendationId" | "confidence" | "evidenceId" | "createdAt"> & {
  evidence: EvidenceBundle;
  playbook?: Playbook | null;
};

export function buildRecommendation(input: RecommendationInput): Recommendation {
  const evidence = input.evidence;
  return {
    recommendationId: `rec_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    organizationId: input.organizationId,
    summary: input.summary,
    diagnosis: input.diagnosis,
    problem: input.problem,
    impact: input.impact,
    financialValueCents: Math.max(0, Math.floor(input.financialValueCents)),
    urgency: input.urgency,
    complexity: input.complexity,
    checklist: input.checklist,
    playbookId: input.playbook?.playbookId ?? input.playbookId ?? null,
    evidenceId: evidence.evidenceId,
    confidence: evidence.confidence,
    createdAt: new Date().toISOString(),
  };
}
