// EPIC B — Tests for Execution Platform (Executor / Bridge / Router / Metrics)
import { describe, it, expect } from "vitest";
import { WorkflowExecutor } from "@/lib/ai/executor";
import { ProviderBridge } from "@/lib/ai/bridge";
import { ClaudeAdapter } from "@/lib/ai/adapters/claude-adapter";
import { ExecutionScheduler } from "@/lib/ai/scheduler";
import { ExecutionMetrics } from "@/lib/ai/metrics";
import { InMemoryWorkflowStore, InMemoryTimelineStoreAsync, InMemoryExecutionResultStore } from "@/lib/ai/persistence";
import type { Workflow } from "@/lib/ai/contracts/workflow";
import { skillRouter } from "@/lib/ai/skill-router";
import { pickFallback } from "@/lib/ai/fallback";
import { analyzers } from "@/lib/ai/analyzers";

function makeWorkflow(): Workflow {
  return {
    workflowId: "wf_test", planId: "plan_1", organizationId: "org_1",
    fingerprint: "abc123def4567890",
    steps: [
      { id: "s1", name: "S1", skill: "campaign_analysis", provider: "anthropic",
        model: "claude-3-5-sonnet-latest", dependencies: [],
        estimatedCost: 5, estimatedLatency: 200, priority: 1,
        status: "ready", requiredCapabilities: [] },
      { id: "s2", name: "S2", skill: "campaign_analysis", provider: "anthropic",
        model: "claude-3-5-sonnet-latest", dependencies: ["s1"],
        estimatedCost: 5, estimatedLatency: 200, priority: 1,
        status: "pending", requiredCapabilities: [] },
    ],
    createdAt: new Date().toISOString(),
    version: 1, status: "ready",
  };
}

function makeAdapter() {
  return new ClaudeAdapter({
    invoker: async (req) => ({
      text: `ok:${req.model}`, tokensIn: 100, tokensOut: 200,
      finishReason: "stop", raw: null, toolCalls: [],
    }),
  });
}

describe("EPIC B · WorkflowExecutor", () => {
  it("executes steps respecting dependencies and produces a completed result", async () => {
    const bridge = new ProviderBridge(); bridge.register(makeAdapter());
    const metrics = new ExecutionMetrics();
    const events: string[] = [];
    const exec = new WorkflowExecutor({
      bridge, metrics,
      workflowStore: new InMemoryWorkflowStore(),
      timeline: new InMemoryTimelineStoreAsync(),
      resultStore: new InMemoryExecutionResultStore(),
      onEvent: (e) => events.push(e.name),
    });

    const result = await exec.execute(makeWorkflow(),
      { organizationId: "org_1", agent: "campaign_analyst", plan: "pro", role: "admin", taskId: "task_1" },
      { budget: { maxCostCents: 100, maxLatencyMs: 60_000, maxSteps: 10 }, parallelism: 2 });

    expect(result.status).toBe("completed");
    expect(result.stepResults).toHaveLength(2);
    expect(result.stepResults.every((s) => s.status === "succeeded")).toBe(true);
    expect(events).toContain("ExecutionStarted");
    expect(events).toContain("ExecutionFinished");
    expect(metrics.snapshot().runs).toBe(1);
  });

  it("fails when budget is exceeded before completing all steps", async () => {
    const bridge = new ProviderBridge(); bridge.register(makeAdapter());
    const exec = new WorkflowExecutor({ bridge });
    const result = await exec.execute(makeWorkflow(),
      { organizationId: "org_1", agent: "campaign_analyst", plan: "pro", role: "admin", taskId: "task_1" },
      { budget: { maxCostCents: 0, maxLatencyMs: 60_000, maxSteps: 10 } });
    expect(result.status === "failed" || result.status === "partial").toBe(true);
    expect(result.reasonCodes.length).toBeGreaterThan(0);
  });

  it("aborts when the AbortSignal fires before first step", async () => {
    const bridge = new ProviderBridge(); bridge.register(makeAdapter());
    const exec = new WorkflowExecutor({ bridge });
    const ac = new AbortController(); ac.abort();
    const result = await exec.execute(makeWorkflow(),
      { organizationId: "org_1", agent: "campaign_analyst", plan: "pro", role: "admin", taskId: "task_1" },
      { budget: { maxCostCents: 100, maxLatencyMs: 60_000, maxSteps: 10 }, abortSignal: ac.signal });
    expect(result.status).toBe("cancelled");
  });
});

describe("EPIC B · ProviderBridge", () => {
  it("rejects unknown provider without throwing", async () => {
    const bridge = new ProviderBridge();
    const r = await bridge.invoke("nope", "x", { systemPrompt: "s", userPrompt: "u" });
    expect(r.response).toBeNull();
    expect(r.error).toContain("unknown_provider");
  });

  it("rejects unsupported model", async () => {
    const bridge = new ProviderBridge(); bridge.register(makeAdapter());
    const r = await bridge.invoke("anthropic", "no-such-model", { systemPrompt: "s", userPrompt: "u" });
    expect(r.error).toContain("unsupported_model");
  });
});

describe("EPIC B · Scheduler", () => {
  it("dequeues by priority", () => {
    const s = new ExecutionScheduler();
    const wf = makeWorkflow();
    s.enqueue(wf, 1); const high = s.enqueue({ ...wf, workflowId: "wf_high" }, 9);
    expect(s.next()?.ticket).toBe(high.ticket);
  });

  it("cancel + pause + resume transitions", () => {
    const s = new ExecutionScheduler();
    const e = s.enqueue(makeWorkflow(), 5);
    expect(s.cancel(e.ticket)).toBe(true);
    const e2 = s.enqueue(makeWorkflow(), 5);
    s.next();
    expect(s.pause(e2.ticket)).toBe(true);
    expect(s.resume(e2.ticket)).toBe(true);
  });
});

describe("EPIC B · SkillRouter + Fallback", () => {
  it("router returns null when no capability matches", () => {
    const route = skillRouter.route({
      step: { id: "s", name: "S", skill: "unknown_skill", provider: null, model: null,
        dependencies: [], estimatedCost: 0, estimatedLatency: 0, priority: 1,
        status: "ready", requiredCapabilities: [] },
      agent: "campaign_analyst", plan: "pro", role: "admin",
    });
    expect(route).toBeNull();
  });

  it("fallback picks a different provider when candidates exist", () => {
    const fb = pickFallback({ provider: "openai", model: "gpt-x" }, [
      { provider: "anthropic", model: "claude-3-5-sonnet-latest", score: 0.9, reason: "ok" },
    ] as never);
    expect(fb.used).toBe(true);
    expect(fb.to?.provider).toBe("anthropic");
  });
});

describe("EPIC B · Analyzer Registry", () => {
  it("exposes 10 default analytical domains", () => {
    expect(analyzers.list().length).toBe(10);
    expect(analyzers.get("marketing")?.suggestedProviders).toContain("anthropic");
  });
});
