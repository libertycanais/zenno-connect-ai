// FEATURE P0.6 — Onda 5 · Governance contracts tests
import { describe, it, expect } from "vitest";
import {
  InMemoryRuleRegistry,
  InMemoryContextSnapshotStore,
  InMemoryArtifactLineageStore,
  DecisionTraceBuilder,
  evaluateConfidence,
  fingerprint16,
  fingerprintInputShape,
  type ConfidenceThresholdPolicy,
  type ContextSnapshot,
} from "@/lib/ai/governance";

describe("Governance · RuleRegistry", () => {
  it("registers, activates and preserves history immutably", async () => {
    const r = new InMemoryRuleRegistry();
    await r.register("k", "1.0.0", "a");
    await r.register("k", "1.1.0", "b");
    expect(r.active("k")?.version).toBe("1.0.0");
    r.activate("k", "1.1.0");
    expect(r.active("k")?.version).toBe("1.1.0");
    expect(r.history("k")).toHaveLength(2);
    await expect(r.register("k", "1.0.0", "x")).rejects.toThrow(/immutable/);
    expect(r.ref("k")?.fingerprint).toHaveLength(16);
  });
});

describe("Governance · ContextSnapshotStore", () => {
  it("put/get roundtrip", async () => {
    const s = new InMemoryContextSnapshotStore();
    const snap: ContextSnapshot = {
      snapshotId: "s1", organizationId: "o", agent: "free_chat",
      takenAt: new Date().toISOString(), modules: ["billing"],
      tokensEstimated: 100, fingerprint: await fingerprint16("x"), ttlSeconds: 60,
    };
    await s.put(snap, "body");
    const got = await s.get("s1");
    expect(got?.body).toBe("body");
    expect(await s.get("nope")).toBeNull();
  });
});

describe("Governance · ArtifactLineageStore", () => {
  it("walks ancestors", async () => {
    const l = new InMemoryArtifactLineageStore();
    const base = { producedBy: { traceId: "t", stepIndex: 0, skillId: null, model: null }, contextSnapshotId: null, ruleRefs: [], createdAt: "" };
    await l.record({ ...base, artifact: { artifactId: "A", kind: "k", version: 1 }, inputs: [] });
    await l.record({ ...base, artifact: { artifactId: "B", kind: "k", version: 1 }, inputs: [{ artifactId: "A", kind: "k", version: 1 }] });
    const anc = await l.ancestors("B");
    expect(anc.map((n) => n.artifact.artifactId)).toEqual(["B", "A"]);
  });
});

describe("Governance · DecisionTraceBuilder", () => {
  it("appends steps and finishes", () => {
    const b = new DecisionTraceBuilder({
      traceId: "t", organizationId: "o", userId: "u", agent: "free_chat",
      startedAt: new Date().toISOString(),
    });
    b.step({ stage: "policy", actor: "policy", input: null, output: null, decision: "allow", reasonCode: "ok" });
    const t = b.finish("success");
    expect(t.steps).toHaveLength(1);
    expect(t.outcome).toBe("success");
    expect(t.finishedAt).not.toBeNull();
  });
});

describe("Governance · evaluateConfidence", () => {
  const policy: ConfidenceThresholdPolicy = {
    agent: "free_chat", minConfidence: 0.7, onBelow: "annotate",
    requireSources: true, maxStaleModules: 1,
  };
  it("passes when all criteria met", () => {
    expect(evaluateConfidence(0.9, policy, { staleModules: 0, hasSources: true }).passed).toBe(true);
  });
  it("fails below threshold", () => {
    expect(evaluateConfidence(0.5, policy, { staleModules: 0, hasSources: true }).reason).toMatch(/below-threshold/);
  });
  it("fails missing sources", () => {
    expect(evaluateConfidence(0.9, policy, { staleModules: 0, hasSources: false }).reason).toBe("missing-sources");
  });
  it("fails too stale", () => {
    expect(evaluateConfidence(0.9, policy, { staleModules: 5, hasSources: true }).reason).toMatch(/too-stale/);
  });
});

describe("Governance · fingerprints", () => {
  it("sha256 short is stable and 16 hex", async () => {
    const a = await fingerprint16("hello");
    const b = await fingerprint16("hello");
    expect(a).toBe(b);
    expect(a).toHaveLength(16);
  });
  it("fingerprintInputShape is a documented stub until Onda 5+", () => {
    expect(() => fingerprintInputShape({})).toThrow(/not implemented/);
  });
});
