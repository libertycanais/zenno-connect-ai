import { describe, it, expect } from "vitest";
import { WorkflowBuilder } from "@/lib/ai/workflow";
import type { Plan } from "@/lib/ai/planner";

const plan: Plan = {
  planId: "plan_abc",
  organizationId: "org-1", userId: "user-1",
  agent: "campaign_analyst", kind: "analysis", status: "draft",
  objective: "test", createdAt: new Date().toISOString(),
  steps: [
    { index: 0, skillId: "s1", provider: "openai", model: "gpt-5.5", priority: 5,
      dependsOn: [], estimatedInputTokens: 100, estimatedOutputTokens: 50,
      estimatedCostCents: 1, estimatedLatencyMs: 500, requiredCapabilities: [], producesArtifactKinds: [] },
    { index: 1, skillId: "s2", provider: "anthropic", model: "claude", priority: 5,
      dependsOn: [0], estimatedInputTokens: 100, estimatedOutputTokens: 50,
      estimatedCostCents: 1, estimatedLatencyMs: 500, requiredCapabilities: [], producesArtifactKinds: [] },
  ],
  totalCostCents: 2, totalLatencyMs: 1000, totalTokens: 300,
  fingerprint: "abcdef0000000000", featureFlags: [], reasonCodes: [],
};

describe("WorkflowBuilder", () => {
  it("converts a plan into a workflow with deps preserved", () => {
    const wf = new WorkflowBuilder().build(plan);
    expect(wf.steps.length).toBe(2);
    expect(wf.steps[0].dependencies).toEqual([]);
    expect(wf.steps[1].dependencies).toEqual([wf.steps[0].id]);
    expect(wf.steps[0].status).toBe("ready");
    expect(wf.steps[1].status).toBe("pending");
  });

  it("produces deterministic fingerprints", () => {
    const a = new WorkflowBuilder().build(plan);
    const b = new WorkflowBuilder().build(plan);
    expect(a.fingerprint).toBe(b.fingerprint);
  });

  it("ready() returns only steps with satisfied deps", () => {
    const b = new WorkflowBuilder();
    const wf = b.build(plan);
    expect(b.ready(wf, new Set())).toEqual([]);
    const ready = b.ready(wf, new Set([wf.steps[0].id]));
    expect(ready.length).toBe(1);
    expect(ready[0].id).toBe(wf.steps[1].id);
  });

  it("respects overrideProvider/overrideModel", () => {
    const wf = new WorkflowBuilder().build(plan, { overrideProvider: "google", overrideModel: "gemini" });
    for (const s of wf.steps) {
      expect(s.provider).toBe("google");
      expect(s.model).toBe("gemini");
    }
  });
});
