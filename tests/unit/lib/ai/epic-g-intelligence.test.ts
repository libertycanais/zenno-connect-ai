import { describe, it, expect } from "vitest";
import { InsightEngine } from "@/lib/ai/insights";
import { detectAnomalies } from "@/lib/ai/anomalies";
import { computeTrend } from "@/lib/ai/trends";
import { detectOpportunities } from "@/lib/ai/opportunities";
import { assessRisk } from "@/lib/ai/risk";
import { pearson, coOccurrence } from "@/lib/ai/correlation";
import { weightedMajority } from "@/lib/ai/consensus";
import type { BusinessSignal } from "@/lib/ai/signals";

function s(type: BusinessSignal["type"], overrides: Partial<BusinessSignal> = {}): BusinessSignal {
  return {
    id: `sig_${type}`, organizationId: "org-1", type, domain: "marketing",
    severity: "high", score: 70, priority: 2, confidence: 0.8,
    createdAt: new Date().toISOString(),
    source: { origin: "kpi" }, evidence: [], recommendedExperts: ["marketing"],
    status: "open", dedupeKey: `k_${type}`, ...overrides,
  };
}

describe("EPIC G · InsightEngine", () => {
  it("builds creative-fatigue insight when 3 signals co-exist", () => {
    const insights = new InsightEngine().build([s("ROASDrop"), s("CTRDrop"), s("CPAIncrease")]);
    expect(insights).toHaveLength(1);
    const [ins] = insights;
    expect(ins.playbook.experts).toContain("marketing");
    expect(ins.playbook.checklist.length).toBeGreaterThan(0);
    expect(ins.playbook.actionPlan.length).toBeGreaterThan(0);
    expect(ins.playbook.successCriteria.length).toBeGreaterThan(0);
  });

  it("builds revenue-risk insight for MRRDrop+ChurnIncrease", () => {
    const insights = new InsightEngine().build([s("MRRDrop", { domain: "sales" }), s("ChurnIncrease", { domain: "sales" })]);
    expect(insights.find(i => i.title.includes("receita"))).toBeTruthy();
  });
});

describe("EPIC G · Anomaly / Trend / Correlation", () => {
  it("detects outlier via zscore", () => {
    const res = detectAnomalies([1, 1, 1, 1, 1, 10], { method: "zscore", threshold: 1.5 });
    expect(res.at(-1)?.isAnomaly).toBe(true);
  });
  it("computes upward trend", () => {
    const t = computeTrend([1, 2, 3, 4, 5]);
    expect(t.direction).toBe("up");
    expect(t.slope).toBeGreaterThan(0);
  });
  it("pearson correlates two increasing series", () => {
    expect(pearson([1, 2, 3, 4], [2, 4, 6, 8])).toBeCloseTo(1, 5);
  });
  it("co-occurrence groups signal types by day", () => {
    const edges = coOccurrence([s("ROASDrop"), s("CTRDrop")]);
    expect(edges).toEqual(expect.arrayContaining([expect.objectContaining({ support: 1 })]));
  });
});

describe("EPIC G · Risk + Opportunity + Consensus", () => {
  it("classifies critical risk from high-severity signals", () => {
    const r = assessRisk("org-1", [s("ROASDrop", { severity: "critical", confidence: 1 })]);
    expect(r.level).toBe("critical");
    expect(r.score).toBeGreaterThanOrEqual(85);
  });
  it("returns low risk when no signals", () => {
    expect(assessRisk("org-1", []).level).toBe("low");
  });
  it("finds opportunities from upside signals", () => {
    const opps = detectOpportunities([s("LeadGrowth", { domain: "crm" })]);
    expect(opps).toHaveLength(1);
  });
  it("weighted-majority consensus flags majority recs", () => {
    const rec = { recommendationId: "r1" } as never;
    const res = weightedMajority({
      organizationId: "org-1", topic: "roas",
      expertOutputs: [
        { expertId: "marketing", evidence: {} as never, recommendations: [rec], playbooks: [], generatedAt: "" },
        { expertId: "finance",   evidence: {} as never, recommendations: [rec], playbooks: [], generatedAt: "" },
      ] as never,
    });
    expect(res.finalRecommendations).toContain("r1");
    expect(res.method).toBe("weighted");
  });
});
