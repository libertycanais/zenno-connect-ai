// EPIC I — Executive Action utilities: Ranking, Risk Matrix, Opportunity Scoring, Alert Prioritization
import type { ExecutivePriorityItem, ExecutiveRisk, ExecutiveOpportunity } from "../executive/types";

export function rankPriorities(items: ExecutivePriorityItem[]): ExecutivePriorityItem[] {
  return [...items].sort((a, b) => a.priority - b.priority
    || (Math.abs(b.impactCents) * b.confidence) - (Math.abs(a.impactCents) * a.confidence));
}

export type RiskMatrixCell = { likelihoodBucket: "L" | "M" | "H"; impactBucket: "L" | "M" | "H"; risks: ExecutiveRisk[] };

export function buildRiskMatrix(risks: ExecutiveRisk[]): RiskMatrixCell[] {
  const bucket = (n: number, lo: number, hi: number): "L" | "M" | "H" => (n < lo ? "L" : n < hi ? "M" : "H");
  const cells = new Map<string, RiskMatrixCell>();
  for (const r of risks) {
    const l = bucket(r.likelihood, 0.34, 0.67);
    const i = bucket(Math.abs(r.impactCents), 100_00, 10_000_00);
    const key = `${l}-${i}`;
    if (!cells.has(key)) cells.set(key, { likelihoodBucket: l, impactBucket: i, risks: [] });
    cells.get(key)!.risks.push(r);
  }
  return [...cells.values()];
}

export function scoreOpportunities(opps: ExecutiveOpportunity[]): Array<ExecutiveOpportunity & { score: number }> {
  return opps.map((o) => ({
    ...o,
    score: (o.upsideCents / 100) * o.confidence * (o.effort === "low" ? 1.2 : o.effort === "high" ? 0.7 : 1),
  })).sort((a, b) => b.score - a.score);
}

export type ExecutiveAlert = { id: string; title: string; priority: number; severity: "critical" | "warn" | "info" };
export function prioritizeAlerts(alerts: ExecutiveAlert[]): ExecutiveAlert[] {
  const sev = (s: "critical" | "warn" | "info"): number => s === "critical" ? 0 : s === "warn" ? 1 : 2;
  return [...alerts].sort((a, b) => sev(a.severity) - sev(b.severity) || a.priority - b.priority);
}
