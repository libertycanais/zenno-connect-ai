// Opportunity Engine — surfaces upside signals (growth, expansion).
import type { BusinessSignal } from "../signals/types";

export type Opportunity = {
  id: string;
  organizationId: string;
  title: string;
  rationale: string;
  score: number;              // 0..100
  signalIds: string[];
  suggestedExperts: string[];
  createdAt: string;
};

const upsideTypes = new Set(["LeadGrowth", "RevenueGrowth", "HighOpportunity"]);

export function detectOpportunities(signals: BusinessSignal[]): Opportunity[] {
  const out: Opportunity[] = [];
  for (const s of signals) {
    if (!upsideTypes.has(s.type)) continue;
    out.push({
      id: `opp_${s.id}`, organizationId: s.organizationId,
      title: `Oportunidade: ${s.type}`,
      rationale: `Sinal ${s.type} com score ${s.score} indica janela de aceleração.`,
      score: s.score, signalIds: [s.id],
      suggestedExperts: s.recommendedExperts,
      createdAt: new Date().toISOString(),
    });
  }
  return out;
}
