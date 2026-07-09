import { describe, it, expect } from "vitest";
import { TimelineStore } from "@/lib/ai/timeline";

describe("TimelineStore", () => {
  it("appends and reads by task", () => {
    const s = new TimelineStore();
    s.append({
      organizationId: "o1", taskId: "t1", planId: null, workflowId: null,
      stage: "task_created", latencyMs: null, tokensIn: null, tokensOut: null,
      provider: null, model: null, skill: null, costCents: null,
      status: "queued", reasonCode: null, meta: {},
    });
    s.append({
      organizationId: "o1", taskId: "t1", planId: "p1", workflowId: null,
      stage: "plan_built", latencyMs: 100, tokensIn: 0, tokensOut: 0,
      provider: null, model: null, skill: null, costCents: 0,
      status: "running", reasonCode: "ok", meta: {},
    });
    const rows = s.forTask("t1");
    expect(rows.length).toBe(2);
    expect(rows[0].stage).toBe("task_created");
    expect(s.latestStage("t1")).toBe("plan_built");
  });

  it("filters by organization and orders by timestamp", () => {
    const s = new TimelineStore();
    for (const t of ["a", "b"]) {
      s.append({
        organizationId: "o1", taskId: t, planId: null, workflowId: null,
        stage: "task_created", latencyMs: null, tokensIn: null, tokensOut: null,
        provider: null, model: null, skill: null, costCents: null,
        status: "queued", reasonCode: null, meta: {},
      });
    }
    s.append({
      organizationId: "o2", taskId: "c", planId: null, workflowId: null,
      stage: "task_created", latencyMs: null, tokensIn: null, tokensOut: null,
      provider: null, model: null, skill: null, costCents: null,
      status: "queued", reasonCode: null, meta: {},
    });
    expect(s.forOrganization("o1").length).toBe(2);
    expect(s.forOrganization("o2").length).toBe(1);
  });

  it("supports clear and size", () => {
    const s = new TimelineStore();
    s.append({
      organizationId: "o1", taskId: "t1", planId: null, workflowId: null,
      stage: "task_created", latencyMs: null, tokensIn: null, tokensOut: null,
      provider: null, model: null, skill: null, costCents: null,
      status: "queued", reasonCode: null, meta: {},
    });
    expect(s.size()).toBe(1);
    s.clear();
    expect(s.size()).toBe(0);
  });
});
