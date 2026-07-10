// EPIC I — Executive Intelligence tests
import { describe, expect, it } from "vitest";
import {
  ExecutiveEngine, buildExecutiveReport, computeExecutiveScore,
  runMultiExpertConsensus, ExecutiveAdvisor,
  InMemoryExecutiveReportStore,
} from "@/lib/ai/executive";
import { runScenario } from "@/lib/ai/scenarios";
import { forecast } from "@/lib/ai/forecast";
import { ExecutiveCache } from "@/lib/ai/executive-cache";
import { toMarkdown } from "@/lib/ai/reporting";
import { rankPriorities, buildRiskMatrix, scoreOpportunities } from "@/lib/ai/executive-actions";
import { classifyKpi } from "@/lib/ai/executive-kpis";
import { nullVectorProvider } from "@/lib/ai/vector";
import type { Expert } from "@/lib/ai/experts/types";

const ORG = "org_test_i";

const kpis = [
  { kpi: "roas", label: "ROAS", value: 1.2, unit: "x", severity: "critical" as const, delta: -0.3 },
  { kpi: "cac",  label: "CAC",  value: 500, unit: "R$", severity: "warn"     as const, delta: 0.1 },
  { kpi: "mrr",  label: "MRR",  value: 10_000, unit: "R$", severity: "info"  as const, delta: 0.05 },
];

const expertOutputs = [
  { expertId: "marketing" as const, evidence: { items: [], generatedAt: "" } as never,
    recommendations: [{ recommendationId: "rec_1", id: "rec_1", title: "Reduzir CAC via SEO", expectedImpactCents: 500_000, confidence: 0.7 }] as never,
    playbooks: [{ playbookId: "pb_1", id: "pb_1" }] as never,
    generatedAt: new Date().toISOString() },
];

describe("Epic I · ExecutiveScore", () => {
  it("computes weighted score with defaults", () => {
    const s = computeExecutiveScore({ businessHealth: 80, financial: 60, marketing: 70 });
    expect(s.overall).toBeGreaterThan(0);
    expect(s.overall).toBeLessThanOrEqual(100);
    expect(s.dimensions.length).toBeGreaterThan(0);
  });
  it("clamps out-of-range inputs", () => {
    const s = computeExecutiveScore({ businessHealth: 500, financial: -10 });
    expect(s.overall).toBeLessThanOrEqual(100);
  });
});

describe("Epic I · Executive Report", () => {
  it("builds a report with priorities, risks and opportunities", () => {
    const rep = buildExecutiveReport({
      organizationId: ORG, topic: "diagnostic", kpis, expertOutputs,
      signals: [{ id: "sig_1", title: "Queda de conversão", severity: "critical", impactCents: -300_000 }],
    });
    expect(rep.organizationId).toBe(ORG);
    expect(rep.priorities.length).toBeGreaterThan(0);
    expect(rep.risks.length).toBeGreaterThan(0);
    expect(rep.opportunities.length).toBeGreaterThan(0);
    expect(rep.narrative).toContain("Executive Brief");
    expect(rep.score.overall).toBeGreaterThanOrEqual(0);
  });
  it("cross-tenant safe: distinct orgs yield distinct reports", () => {
    const a = buildExecutiveReport({ organizationId: "org_a", topic: "t", kpis, expertOutputs });
    const b = buildExecutiveReport({ organizationId: "org_b", topic: "t", kpis, expertOutputs });
    expect(a.organizationId).not.toBe(b.organizationId);
  });
});

describe("Epic I · ExecutiveEngine + Consensus", () => {
  it("runs multi-expert consensus when experts provided", () => {
    const experts: Expert[] = [
      { descriptor: { id: "marketing" } as never, run: () => expertOutputs[0]! as never },
      { descriptor: { id: "sales" } as never,     run: () => ({ ...expertOutputs[0]!, expertId: "sales" }) as never },
    ];
    const engine = new ExecutiveEngine();
    const r = engine.run({
      organizationId: ORG, topic: "diag", kpis, expertOutputs: [],
      experts, expertRunInput: { organizationId: ORG, focus: "diag", kpis: [], triggeredRules: [] },
    });
    expect(r.consensus).not.toBeNull();
    expect(r.explainability.expertsInvolved.length).toBeGreaterThan(0);
  });
  it("consensus runner captures failures", () => {
    const experts: Expert[] = [
      { descriptor: { id: "marketing" } as never, run: () => { throw new Error("boom"); } },
    ];
    const res = runMultiExpertConsensus({
      organizationId: ORG, topic: "t", experts,
      runInput: { organizationId: ORG, focus: "", kpis: [], triggeredRules: [] },
    });
    expect(res.failures.length).toBe(1);
    expect(res.expertOutputs.length).toBe(0);
  });
});

describe("Epic I · Advisor", () => {
  it("answers 7 executive questions", () => {
    const rep = buildExecutiveReport({ organizationId: ORG, topic: "t", kpis, expertOutputs });
    const answers = ExecutiveAdvisor.all(rep);
    expect(answers.length).toBe(7);
    for (const a of answers) expect(a.answer.length).toBeGreaterThan(0);
  });
});

describe("Epic I · Scenario + Forecast", () => {
  it("scenario computes projected values", () => {
    const s = runScenario({ organizationId: ORG, name: "boost", baseline: { revenue: 1000, spend: 200 }, changes: { revenue: 0.2, spend: 0.1 } });
    expect(s.projected.revenue).toBeCloseTo(1200);
    expect(s.netImpact).toBeGreaterThan(0);
  });
  it("forecast trend extrapolates", () => {
    const f = forecast({
      organizationId: ORG, metric: "revenue", horizon: 3,
      history: [{ t: 1, value: 100 }, { t: 2, value: 200 }, { t: 3, value: 300 }],
    });
    expect(f.method).toBe("trend");
    expect(f.forecast[0]!.value).toBeCloseTo(400);
  });
});

describe("Epic I · Cache + Persistence + Reporting", () => {
  it("cache respects TTL and org scope", async () => {
    const c = new ExecutiveCache<string>();
    c.set("a", "k", "v", 1000);
    expect(c.get("a", "k")).toBe("v");
    expect(c.get("b", "k")).toBeNull();
    c.invalidate("a");
    expect(c.get("a", "k")).toBeNull();
  });
  it("persistence stores and lists per org", async () => {
    const store = new InMemoryExecutiveReportStore();
    const rep = buildExecutiveReport({ organizationId: ORG, topic: "t", kpis, expertOutputs });
    await store.save(rep);
    expect(await store.get(rep.reportId)).not.toBeNull();
    expect((await store.listByOrganization(ORG)).length).toBe(1);
    expect((await store.latest(ORG))?.reportId).toBe(rep.reportId);
    expect(await store.latest("other")).toBeNull();
  });
  it("reporting markdown includes score and priorities", () => {
    const rep = buildExecutiveReport({ organizationId: ORG, topic: "t", kpis, expertOutputs });
    const md = toMarkdown(rep);
    expect(md).toContain("Executive Report");
    expect(md).toContain("Score");
  });
});

describe("Epic I · KPI + Actions + Vector null provider", () => {
  it("classifyKpi maps ranges", () => {
    expect(classifyKpi(5, { ok: 3, warn: 1 })).toBe("info");
    expect(classifyKpi(2, { ok: 3, warn: 1 })).toBe("warn");
    expect(classifyKpi(0, { ok: 3, warn: 1 })).toBe("critical");
    expect(classifyKpi(null, { ok: 3, warn: 1 })).toBe("warn");
  });
  it("ranks priorities and opportunities", () => {
    const rep = buildExecutiveReport({ organizationId: ORG, topic: "t", kpis, expertOutputs });
    expect(rankPriorities(rep.priorities)[0]!.priority).toBeLessThanOrEqual(rep.priorities.at(-1)!.priority);
    expect(scoreOpportunities(rep.opportunities).length).toBe(rep.opportunities.length);
    expect(buildRiskMatrix(rep.risks).length).toBeGreaterThan(0);
  });
  it("null vector provider is safe default", async () => {
    expect(await nullVectorProvider.retriever.search([], { organizationId: ORG, topK: 1 })).toEqual([]);
    expect(await nullVectorProvider.embedding.embed("x")).toEqual([]);
  });
});
