// EPIC I — Executive Score (0..100, weighted, configurable)
import type { ExecutiveScore, ExecutiveScoreDimension } from "./types";

export type ScoreWeights = Partial<Record<
  | "businessHealth" | "marketing" | "financial" | "commercial" | "operations"
  | "data" | "tracking" | "governance" | "ai" | "security",
  number
>>;

export type ScoreInputs = Partial<Record<
  | "businessHealth" | "marketing" | "financial" | "commercial" | "operations"
  | "data" | "tracking" | "governance" | "ai" | "security",
  number
>>; // each 0..100

const DEFAULT_WEIGHTS: Required<ScoreWeights> = {
  businessHealth: 0.15,
  marketing:      0.12,
  financial:      0.15,
  commercial:     0.12,
  operations:     0.08,
  data:           0.08,
  tracking:       0.07,
  governance:     0.08,
  ai:             0.07,
  security:       0.08,
};

export function computeExecutiveScore(inputs: ScoreInputs, weights?: ScoreWeights): ExecutiveScore {
  const w = { ...DEFAULT_WEIGHTS, ...(weights ?? {}) };
  // normalize weights to sum=1 (defensive)
  const wSum = Object.values(w).reduce((a, b) => a + b, 0) || 1;
  const dimensions: ExecutiveScoreDimension[] = [];
  let overall = 0;
  for (const key of Object.keys(w) as Array<keyof typeof w>) {
    const weight = w[key] / wSum;
    const score = clamp100(inputs[key] ?? 0);
    overall += score * weight;
    dimensions.push({ name: key, weight, score });
  }
  return {
    overall: Math.round(overall),
    dimensions,
    generatedAt: new Date().toISOString(),
  };
}

function clamp100(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, n));
}
