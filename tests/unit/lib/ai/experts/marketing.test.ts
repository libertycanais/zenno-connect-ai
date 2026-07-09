// EPIC C · Knowledge / Evidence / Playbook / Marketing Expert
import { describe, it, expect } from "vitest";
import { knowledge } from "@/lib/ai/knowledge";
import { buildEvidence, computeConfidence } from "@/lib/ai/evidence";
import { buildPlaybook, validatePlaybook } from "@/lib/ai/playbooks";
import { marketingExpert } from "@/lib/ai/experts/marketing";
import { ctr, roas } from "@/lib/business";

describe("Knowledge Registry", () => {
  it("expõe 15 domínios", () => {
    expect(knowledge.list().length).toBe(15);
    expect(knowledge.get("meta-ads")?.rules.length).toBeGreaterThan(0);
  });
  it("localiza regra por id", () => {
    expect(knowledge.findRule("meta.roas_below_1")?.severity).toBe("critical");
  });
});

describe("Evidence Engine", () => {
  it("penaliza ausência de dados e sobe confiança com fontes diversas", () => {
    const bare = buildEvidence({ organizationId: "org_1" });
    expect(bare.confidence).toBe(0);

    const rich = buildEvidence({
      organizationId: "org_1",
      kpis: [ctr({ clicks: 10, impressions: 1000 })],
      ruleIds: [{ id: "meta.ctr_below_p25", domain: "meta-ads", version: "1.0.0" }],
      benchmarks: [{ key: "meta.ctr", percentile: 12 }],
      snapshots: [{ snapshotId: "snap_1", module: "ads" }],
      raw: [{ description: "meta_ads_insights", sampleSize: 30 }],
    });
    expect(rich.confidence).toBeGreaterThan(0.3);
  });
  it("computeConfidence penaliza missing", () => {
    const c = computeConfidence(
      [{ kind: "kpi", kpi: "roas", value: 3, unit: "ratio", formula: "r/c" }],
      [{ code: "K", description: "missing" }],
    );
    expect(c).toBeLessThan(0.35);
  });
});

describe("Playbook Engine", () => {
  it("aceita playbook completo e rejeita quando faltam campos essenciais", () => {
    const evidence = buildEvidence({
      organizationId: "org_1",
      kpis: [roas({ revenueCents: 1000, adSpendCents: 500 })],
      ruleIds: [{ id: "meta.roas_below_1", domain: "meta-ads", version: "1.0.0" }],
      snapshots: [{ snapshotId: "s", module: "ads" }],
      raw: [{ description: "sample", sampleSize: 10 }],
      benchmarks: [{ key: "meta.roas", percentile: 12 }],
    });
    const pb = buildPlaybook({
      organizationId: "org_1", title: "T", problem: "P", diagnosis: "D",
      evidence, impact: "I", urgency: "high", complexity: "low",
      checklist: [{ id: "c1", title: "x", done: false }],
      actionPlan: [{
        id: "s1", title: "T", description: "D", ownerRole: "marketing",
        dependsOn: [], estimatedMinutes: 30, successCriterion: "kpi_ok",
      }],
      financialEstimate: { costCents: 0, savingsCents: 0, paybackDays: 15 },
      nextSteps: ["a"], successCriteria: ["ok"], expectedOutcome: "melhora",
    });
    expect(validatePlaybook(pb).ok).toBe(true);
  });

  it("rejeita playbook com dependência inexistente", () => {
    const evidence = buildEvidence({
      organizationId: "org_1",
      kpis: [roas({ revenueCents: 1000, adSpendCents: 500 })],
      snapshots: [{ snapshotId: "s", module: "ads" }],
      raw: [{ description: "sample", sampleSize: 10 }],
    });
    const pb = buildPlaybook({
      organizationId: "org_1", title: "T", problem: "P", diagnosis: "D",
      evidence, impact: "I", urgency: "high", complexity: "low",
      checklist: [{ id: "c1", title: "x", done: false }],
      actionPlan: [{
        id: "s1", title: "T", description: "D", ownerRole: "m",
        dependsOn: ["ghost"], estimatedMinutes: 30, successCriterion: "ok",
      }],
      financialEstimate: { costCents: 0, savingsCents: 0, paybackDays: 15 },
      nextSteps: ["a"], successCriteria: ["ok"], expectedOutcome: "e",
    });
    const val = validatePlaybook(pb);
    expect(val.ok).toBe(false);
    expect(val.issues.some((i) => i.startsWith("actionPlan.unknown_dep"))).toBe(true);
  });
});

describe("Marketing Expert", () => {
  it("produz evidência + recomendações + playbooks a partir de regras", () => {
    const kpis = [
      ctr({ clicks: 5, impressions: 1000 }),
      roas({ revenueCents: 400, adSpendCents: 1000 }),
    ];
    const rules = [
      knowledge.findRule("meta.roas_below_1")!,
      knowledge.findRule("meta.ctr_below_p25")!,
    ];
    const out = marketingExpert.run({
      organizationId: "org_1", focus: "auditar performance",
      kpis, triggeredRules: rules,
    });
    expect(out.expertId).toBe("marketing");
    expect(out.recommendations.length).toBe(2);
    expect(out.playbooks.length).toBe(2);
    expect(out.evidence.sources.some((s) => s.kind === "kpi")).toBe(true);
    expect(out.evidence.sources.some((s) => s.kind === "knowledge_rule")).toBe(true);
    expect(out.evidence.sources.some((s) => s.kind === "benchmark")).toBe(true);
  });

  it("marca dados ausentes quando KPIs essenciais faltam", () => {
    const out = marketingExpert.run({
      organizationId: "org_1", focus: "x",
      kpis: [], triggeredRules: [],
    });
    expect(out.evidence.missing.length).toBeGreaterThan(0);
    expect(out.evidence.confidence).toBe(0);
  });
});
