// EPIC H — Comprehensive tests
import { describe, it, expect } from "vitest";
import {
  MemoryEngine, MemoryBuilder, MemoryValidator, MemoryVersioning,
  MemoryMerger, MemoryDecay, MemoryScorer, MemorySearch, MemoryPruner,
  MemoryReplay, MemoryRetriever, MemoryIndexer,
  emptyLineage, noEmbedding, type MemoryInput,
} from "@/lib/ai/memory-engine";
import { BusinessDNAStore, summarizeDNA } from "@/lib/ai/business-dna";
import {
  LearningEngine, FeedbackAnalyzer, LearningScorer, KnowledgeUpdater,
  LearningMetricsCalc, LearningTimeline,
} from "@/lib/ai/learning";
import { DecisionReplayStore } from "@/lib/ai/replay";
import { KnowledgeLineageStore, LineageValidator } from "@/lib/ai/knowledge-lineage";
import { SelfKnowledgeAudit, KnowledgeEvolutionEngine } from "@/lib/ai/self-audit";
import { ExpertFeedbackStore, ExpertCalibrationTracker } from "@/lib/ai/feedback";
import { QualityGate } from "@/lib/ai/memory-quality";
import { OrgProfileStore } from "@/lib/ai/profile";
import { PreferencesStore } from "@/lib/ai/preferences";
import { HistoryStore } from "@/lib/ai/history";

const ORG_A = "org_a";
const ORG_B = "org_b";

function mkInput(org: string, overrides: Partial<MemoryInput> = {}): MemoryInput {
  return {
    organizationId: org,
    scope: "marketing",
    category: "insight",
    title: "Test memory",
    summary: "A summary",
    content: { note: "x" },
    confidence: 0.8,
    importance: 0.6,
    expiresAt: null,
    source: "unit-test",
    tags: ["a", "b"],
    embeddingRef: noEmbedding(),
    embeddingVersion: "v0",
    vectorProvider: "none",
    retrievalMetadata: {},
    knowledgeLineage: emptyLineage(),
    ...overrides,
  };
}

describe("EPIC H · MemoryEngine", () => {
  it("builds, validates and stores a memory scoped to organization", () => {
    const eng = new MemoryEngine();
    const m = eng.put(mkInput(ORG_A));
    expect(m.version).toBe(1);
    expect(MemoryValidator.validate(m).ok).toBe(true);
    expect(eng.get(m.memoryId, ORG_A)).not.toBeNull();
    expect(eng.get(m.memoryId, ORG_B)).toBeNull();
  });

  it("versions memories on update", () => {
    const eng = new MemoryEngine();
    const m = eng.put(mkInput(ORG_A));
    const u = eng.update(m.memoryId, ORG_A, { summary: "updated" });
    expect(u.version).toBe(2);
    expect(u.summary).toBe("updated");
  });

  it("forbids cross-tenant merge", () => {
    const a = MemoryBuilder.build(mkInput(ORG_A));
    const b = MemoryBuilder.build(mkInput(ORG_B));
    expect(() => MemoryMerger.merge(a, b)).toThrow(/cross-tenant/);
  });

  it("merges within same tenant, taking max scores", () => {
    const a = MemoryBuilder.build(mkInput(ORG_A, { confidence: 0.5, importance: 0.4 }));
    const b = MemoryBuilder.build(mkInput(ORG_A, { confidence: 0.9, importance: 0.7, tags: ["c"] }));
    const merged = MemoryMerger.merge(a, b);
    expect(merged.confidence).toBe(0.9);
    expect(merged.importance).toBe(0.7);
    expect(merged.tags).toEqual(expect.arrayContaining(["a", "b", "c"]));
    expect(merged.version).toBe(2);
  });

  it("applies decay and marks archived below threshold", () => {
    const m = MemoryBuilder.build(mkInput(ORG_A));
    const decayed = MemoryDecay.apply(
      { ...m, updatedAt: new Date(Date.now() - 60 * 86_400_000).toISOString() },
      Date.now(),
      { halfLifeDays: 15, archiveBelow: 0.2, removeBelow: 0.05 },
    );
    expect(decayed.freshness).toBeLessThan(m.freshness);
    expect(decayed.archived).toBe(true);
  });

  it("removes expired or too-cold memories via pruner", () => {
    const m1 = MemoryBuilder.build(mkInput(ORG_A));
    const m2 = MemoryBuilder.build(mkInput(ORG_A, { expiresAt: new Date(Date.now() - 1000).toISOString() }));
    const pruned = MemoryPruner.prune([m1, m2], { halfLifeDays: 30, archiveBelow: 0.2, removeBelow: 0.05 });
    expect(pruned.find((r) => r.memoryId === m2.memoryId)).toBeUndefined();
  });

  it("scores memories with composite quality", () => {
    const m = MemoryBuilder.build(mkInput(ORG_A, { confidence: 0.9, importance: 0.9 }));
    const s = MemoryScorer.score(m, { relevance: 0.9, businessImpact: 0.9 });
    expect(s.overallScore).toBeGreaterThan(0.4);
    expect(QualityGate.isUsable(m).ok).toBe(true);
  });

  it("indexer groups memories by organization", () => {
    const a = MemoryBuilder.build(mkInput(ORG_A));
    const b = MemoryBuilder.build(mkInput(ORG_B));
    const idx = MemoryIndexer.index([a, b]);
    expect(idx.get(ORG_A)?.length).toBe(1);
    expect(idx.get(ORG_B)?.length).toBe(1);
  });

  it("search modes stay within tenant scope", () => {
    const eng = new MemoryEngine();
    eng.put(mkInput(ORG_A, { title: "Meta ads pause", tags: ["meta"] }));
    eng.put(mkInput(ORG_B, { title: "Meta ads pause", tags: ["meta"] }));
    const kw = eng.search({ organizationId: ORG_A, text: "meta" }, "keyword");
    expect(kw.every((h) => h.record.organizationId === ORG_A)).toBe(true);
    const hy = eng.search({ organizationId: ORG_A, text: "meta" }, "hybrid");
    expect(hy.length).toBeGreaterThan(0);
    const tg = eng.search({ organizationId: ORG_A, tags: ["meta"] }, "tag");
    expect(tg.length).toBe(1);
    const tp = eng.search({ organizationId: ORG_A }, "temporal");
    expect(tp[0]?.record.organizationId).toBe(ORG_A);
    const im = eng.search({ organizationId: ORG_A }, "importance");
    expect(im[0]?.record.organizationId).toBe(ORG_A);
    // contracts-only stubs return []
    expect(eng.search({ organizationId: ORG_A }, "vector")).toEqual([]);
    expect(eng.search({ organizationId: ORG_A }, "semantic")).toEqual([]);
  });

  it("retriever returns records for hybrid mode", () => {
    const eng = new MemoryEngine();
    eng.put(mkInput(ORG_A, { title: "SEO win" }));
    const recs = MemoryRetriever.top({ organizationId: ORG_A, text: "seo" }, eng.list(ORG_A));
    expect(recs[0]?.title).toBe("SEO win");
  });

  it("replay filters to snapshot at given time", () => {
    const eng = new MemoryEngine();
    const m1 = eng.put(mkInput(ORG_A));
    m1.createdAt = new Date(Date.now() - 60_000).toISOString();
    eng.update(m1.memoryId, ORG_A, { createdAt: m1.createdAt });
    const at = new Date(Date.now() - 30_000).toISOString();
    eng.put(mkInput(ORG_A));
    expect(MemoryReplay.snapshot(eng.list(ORG_A), ORG_A, at).length).toBe(1);
  });

  it("markUsed accumulates usage and successRate", () => {
    const eng = new MemoryEngine();
    const m = eng.put(mkInput(ORG_A));
    const used = eng.markUsed(m.memoryId, ORG_A, { success: true, feedback: 1 });
    expect(used.usageCount).toBe(1);
    expect(used.successRate).toBe(1);
  });

  it("versioning bumps and preserves ids", () => {
    const m = MemoryBuilder.build(mkInput(ORG_A));
    const next = MemoryVersioning.bump(m, { summary: "s2" });
    expect(next.memoryId).toBe(m.memoryId);
    expect(next.version).toBe(2);
  });
});

describe("EPIC H · Business DNA", () => {
  it("upserts and reads DNA scoped to org", () => {
    const store = new BusinessDNAStore();
    const dna = store.upsert({
      organizationId: ORG_A,
      market: "SaaS", businessModel: "subscription", avgTicketCents: 9900,
      marginPercent: 60, objectives: ["MRR growth"], positioning: "premium",
      digitalMaturity: "growing", riskProfile: "balanced", priorityKpis: ["MRR"],
      products: ["Suite"], services: [], audiences: ["SMB"], strategies: ["PLG"],
      preferences: {}, communicationTone: "executive", restrictions: [], history: [],
    });
    expect(dna.version).toBe(1);
    expect(store.get(ORG_A)?.market).toBe("SaaS");
    expect(store.get(ORG_B)).toBeNull();
    expect(summarizeDNA(dna)).toContain("Market=SaaS");
  });

  it("require throws when missing", () => {
    const store = new BusinessDNAStore();
    expect(() => store.require(ORG_A)).toThrow(/missing/);
  });
});

describe("EPIC H · Learning Engine", () => {
  it("collects, aggregates and produces updates", () => {
    const eng = new LearningEngine();
    eng.collect({ organizationId: ORG_A, source: "user_feedback", entityKind: "recommendation", entityId: "rec1", score: 1, metadata: {} });
    eng.collect({ organizationId: ORG_A, source: "outcome", entityKind: "recommendation", entityId: "rec1", score: 1, metadata: {} });
    eng.collect({ organizationId: ORG_A, source: "outcome", entityKind: "playbook", entityId: "pb1", score: -1, metadata: {} });
    const session = eng.run(ORG_A);
    expect(session.samples.length).toBe(3);
    expect(session.insights.length).toBe(2);
    const boost = session.updates.find((u) => u.action === "boost");
    const retire = session.updates.find((u) => u.action === "retire");
    expect(boost).toBeDefined();
    expect(retire).toBeDefined();
    expect(session.metrics.totalSamples).toBe(3);
  });

  it("scorer averages entity scores", () => {
    const insights = FeedbackAnalyzer.aggregate([
      { sampleId: "1", organizationId: ORG_A, source: "user_feedback", entityKind: "expert", entityId: "marketing", score: 1, metadata: {}, createdAt: new Date().toISOString() },
      { sampleId: "2", organizationId: ORG_A, source: "outcome", entityKind: "expert", entityId: "marketing", score: -1, metadata: {}, createdAt: new Date().toISOString() },
    ]);
    expect(LearningScorer.scoreEntity(insights, "expert", "marketing")).toBe(0);
    expect(KnowledgeUpdater.fromInsights(insights)[0]!.action).toBe("flag");
    expect(LearningMetricsCalc.compute([]).totalSamples).toBe(0);
  });

  it("timeline stores chronological events per org", () => {
    const tl = new LearningTimeline();
    tl.add({ organizationId: ORG_A, kind: "created", title: "Org created", payload: {} });
    tl.add({ organizationId: ORG_B, kind: "created", title: "Other org", payload: {} });
    expect(tl.list(ORG_A).length).toBe(1);
    expect(tl.list(ORG_B).length).toBe(1);
  });
});

describe("EPIC H · Decision Replay", () => {
  it("captures immutable snapshot and forbids cross-tenant", () => {
    const store = new DecisionReplayStore();
    const memA = MemoryBuilder.build(mkInput(ORG_A));
    const snap = store.capture({
      organizationId: ORG_A, decisionId: "dec1",
      context: {}, businessDNA: null, memories: [memA],
      promptVersion: "1.0", ruleVersions: {}, expertVersion: "1.0",
      provider: "mock", model: "mock-1", workflow: {}, timeline: [], result: {},
    });
    expect(store.get(snap.replayId, ORG_A)).not.toBeNull();
    expect(store.get(snap.replayId, ORG_B)).toBeNull();
    const memB = MemoryBuilder.build(mkInput(ORG_B));
    expect(() => store.capture({
      organizationId: ORG_A, decisionId: "dec2",
      context: {}, businessDNA: null, memories: [memB],
      promptVersion: "1.0", ruleVersions: {}, expertVersion: "1.0",
      provider: "mock", model: "mock-1", workflow: {}, timeline: [], result: {},
    })).toThrow(/cross-tenant/);
  });
});

describe("EPIC H · Knowledge Lineage", () => {
  it("records complete lineage and enforces origin", () => {
    const store = new KnowledgeLineageStore();
    const node = store.record({
      organizationId: ORG_A, recommendationId: "rec1",
      signalIds: ["s1"], kpiIds: [], businessDnaVersion: 1,
      memoryIds: [], knowledgeDomains: ["marketing"], ruleIds: ["r1"],
      expertId: "marketing", provider: "mock", model: "mock-1",
    });
    expect(LineageValidator.isComplete(node)).toBe(true);
    expect(store.get("rec1", ORG_A)).not.toBeNull();
    expect(store.get("rec1", ORG_B)).toBeNull();
    expect(() => store.record({
      organizationId: ORG_A, recommendationId: "rec2",
      signalIds: [], kpiIds: [], businessDnaVersion: null,
      memoryIds: [], knowledgeDomains: [], ruleIds: [],
      expertId: "marketing", provider: "mock", model: "mock-1",
    })).toThrow(/origin/);
  });
});

describe("EPIC H · Self Audit + Knowledge Evolution", () => {
  it("finds redundant, cold, unused, obsolete and stale artifacts", () => {
    const m1 = MemoryBuilder.build(mkInput(ORG_A, { title: "Same" }));
    const m2 = MemoryBuilder.build(mkInput(ORG_A, { title: "Same" }));
    const old = MemoryBuilder.build(mkInput(ORG_A, { title: "Old" }));
    old.updatedAt = new Date(Date.now() - 45 * 86_400_000).toISOString();
    const findings = SelfKnowledgeAudit.run({
      organizationId: ORG_A,
      memories: [m1, m2, old],
      ruleUsage: { r1: 0, r2: 5 },
      playbookUsage: { pb1: 0 },
      benchmarks: [{ id: "bmk", updatedAt: new Date(Date.now() - 400 * 86_400_000).toISOString() }],
    });
    const kinds = findings.map((f) => f.kind);
    expect(kinds).toEqual(expect.arrayContaining([
      "redundant_memory", "cold_memory", "unused_rule", "obsolete_playbook", "stale_benchmark",
    ]));
    const evo = KnowledgeEvolutionEngine.evolve(findings);
    expect(evo.every((e) => !!e.recommendedAction)).toBe(true);
  });
});

describe("EPIC H · Feedback + Calibration + Profile + Preferences + History", () => {
  it("records expert feedback per org", () => {
    const store = new ExpertFeedbackStore();
    store.record({
      organizationId: ORG_A, expertId: "marketing", recommendationId: "rec1",
      used: true, accepted: true, rejected: false, outcome: "improved",
      timeToResultMs: 1000, financialImpactCents: 5000, userComment: null,
    });
    expect(store.listByOrg(ORG_A).length).toBe(1);
    expect(store.listByOrg(ORG_B).length).toBe(0);
    expect(store.listByExpert(ORG_A, "marketing").length).toBe(1);
  });

  it("tracks expert calibration rolling accuracy", () => {
    const c = new ExpertCalibrationTracker();
    c.record(ORG_A, "marketing", 0.7, true);
    c.record(ORG_A, "marketing", 0.5, false);
    const rec = c.get(ORG_A, "marketing")!;
    expect(rec.predictions).toBe(2);
    expect(rec.rollingAccuracy).toBe(0.5);
    expect(c.listByOrg(ORG_A).length).toBe(1);
  });

  it("profile, preferences and history are org-scoped", () => {
    const p = new OrgProfileStore();
    p.upsert({ organizationId: ORG_A, name: "Acme", industry: "SaaS", size: "smb", language: "pt-BR" });
    expect(p.get(ORG_A)?.name).toBe("Acme");
    expect(p.get(ORG_B)).toBeNull();

    const pr = new PreferencesStore();
    pr.set({ organizationId: ORG_A, tone: "executive", language: "pt-BR", currency: "BRL", timezone: "America/Sao_Paulo", reportingCadence: "weekly", restrictions: [] });
    expect(pr.get(ORG_A)?.tone).toBe("executive");

    const h = new HistoryStore();
    h.append({ organizationId: ORG_A, kind: "recommendation", refId: "r1", summary: "s", payload: {} });
    expect(h.list(ORG_A).length).toBe(1);
    expect(h.list(ORG_B).length).toBe(0);
  });
});
