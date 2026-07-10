// Consensus Engine — Contracts only (Epic G scope). No live execution.
import type { ExpertRunOutput } from "../experts/types";

export type ConsensusInput = {
  organizationId: string;
  topic: string;
  expertOutputs: ExpertRunOutput[];
  weights?: Partial<Record<ExpertRunOutput["expertId"], number>>;
};

export type ConsensusResult = {
  organizationId: string;
  topic: string;
  agreements: string[];      // recommendation ids
  disagreements: string[];
  finalRecommendations: string[];
  confidence: number;        // 0..1
  method: "majority" | "weighted" | "unanimous";
  generatedAt: string;
};

export type ConsensusStrategy = (input: ConsensusInput) => ConsensusResult;

/** Reference weighted-majority strategy (pure). */
export const weightedMajority: ConsensusStrategy = (input) => {
  const votes = new Map<string, number>();
  for (const out of input.expertOutputs) {
    const w = input.weights?.[out.expertId] ?? 1;
    for (const rec of out.recommendations) votes.set(rec.id, (votes.get(rec.id) ?? 0) + w);
  }
  const total = [...votes.values()].reduce((a, b) => a + b, 0) || 1;
  const sorted = [...votes.entries()].sort((a, b) => b[1] - a[1]);
  const finalRecommendations = sorted.filter(([, v]) => v / total >= 0.5).map(([id]) => id);
  const agreements = sorted.filter(([, v]) => v >= 2).map(([id]) => id);
  const disagreements = sorted.filter(([, v]) => v < 2).map(([id]) => id);
  return {
    organizationId: input.organizationId, topic: input.topic,
    agreements, disagreements, finalRecommendations,
    confidence: Math.min(1, sorted[0]?.[1] / total ?? 0),
    method: "weighted", generatedAt: new Date().toISOString(),
  };
};
