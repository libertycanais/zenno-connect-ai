// Business · Reusable scoring primitives (Health, Lead, Campaign, Account, Org)
export type ScoreComponent = {
  name: string;
  weight: number;         // 0..1
  score: number;          // 0..1
};

export type ScoreResult = {
  score: number;                 // 0..1
  normalizedWeights: number;
  components: ScoreComponent[];
};

export function computeScore(components: ScoreComponent[]): number {
  const totalWeight = components.reduce((s, c) => s + Math.max(0, c.weight), 0);
  if (totalWeight === 0) return 0;
  const weighted = components.reduce(
    (s, c) => s + Math.max(0, Math.min(1, c.score)) * Math.max(0, c.weight),
    0,
  );
  return weighted / totalWeight;
}

export function scoreDetailed(components: ScoreComponent[]): ScoreResult {
  const normalizedWeights = components.reduce((s, c) => s + Math.max(0, c.weight), 0);
  return { score: computeScore(components), normalizedWeights, components };
}

// Convenience presets — futura reutilização por outros Experts.
export const LEAD_SCORE_WEIGHTS = {
  fit: 0.35, engagement: 0.25, intent: 0.25, recency: 0.15,
} as const;

export const CAMPAIGN_SCORE_WEIGHTS = {
  roas: 0.35, ctr: 0.2, cvr: 0.2, cac: 0.15, spend_efficiency: 0.1,
} as const;

export const ACCOUNT_SCORE_WEIGHTS = {
  spend_health: 0.3, conversion_health: 0.3, tracking_health: 0.2, policy_compliance: 0.2,
} as const;

export const ORGANIZATION_SCORE_WEIGHTS = {
  business_health: 0.4, growth: 0.25, ops_efficiency: 0.2, retention: 0.15,
} as const;
