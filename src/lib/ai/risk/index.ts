// Risk classification — aggregates severity/confidence into a risk profile.
import type { BusinessSignal } from "../signals/types";

export type RiskLevel = "low" | "moderate" | "elevated" | "high" | "critical";

export type RiskAssessment = {
  organizationId: string;
  level: RiskLevel;
  score: number;              // 0..100
  contributors: Array<{ signalId: string; type: string; weight: number }>;
  computedAt: string;
};

const sevWeight: Record<BusinessSignal["severity"], number> = {
  info: 5, low: 15, medium: 40, high: 70, critical: 95,
};

export function assessRisk(orgId: string, signals: BusinessSignal[]): RiskAssessment {
  if (signals.length === 0) {
    return { organizationId: orgId, level: "low", score: 0, contributors: [], computedAt: new Date().toISOString() };
  }
  const contributors = signals.map(s => ({
    signalId: s.id, type: s.type,
    weight: sevWeight[s.severity] * s.confidence,
  }));
  const raw = contributors.reduce((a, c) => a + c.weight, 0) / contributors.length;
  const score = Math.max(0, Math.min(100, Math.round(raw)));
  const level: RiskLevel =
    score >= 85 ? "critical" : score >= 65 ? "high" : score >= 45 ? "elevated" : score >= 25 ? "moderate" : "low";
  return { organizationId: orgId, level, score, contributors, computedAt: new Date().toISOString() };
}
