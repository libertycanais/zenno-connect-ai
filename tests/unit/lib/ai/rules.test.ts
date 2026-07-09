import { describe, it, expect } from "vitest";
import { BusinessRulesEngine } from "@/lib/ai/rules";
import type { RuleContext } from "@/lib/ai/rules";
import type { PlanRequest } from "@/lib/ai/planner";

const baseRequest: PlanRequest = {
  organizationId: "org-1",
  userId: "user-1",
  agent: "campaign_analyst",
  kind: "analysis",
  objective: "Analisar CAC de julho",
  requiredContext: ["ads", "tracking"],
  constraints: {
    maxCostCents: 100,
    maxLatencyMs: 15000,
    maxSteps: 10,
    requiredCapabilities: [],
  },
  priority: "normal",
};

const baseCtx: RuleContext = {
  organizationId: "org-1",
  userId: "user-1",
  agent: "campaign_analyst",
  plan: "starter",
  role: "analyst",
  featureFlags: ["enablePlanner"],
  budgetRemainingCents: 1000,
  request: baseRequest,
};

describe("BusinessRulesEngine", () => {
  it("allows a well-formed request", async () => {
    const engine = new BusinessRulesEngine();
    const rep = await engine.evaluate(baseCtx);
    expect(rep.outcome).toBe("allow");
    expect(rep.blockingReasons).toEqual([]);
  });

  it("blocks when planner flag is disabled", async () => {
    const engine = new BusinessRulesEngine();
    const rep = await engine.evaluate({ ...baseCtx, featureFlags: [] });
    expect(rep.outcome).toBe("block");
    expect(rep.blockingReasons.some((r) => r.includes("enablePlanner"))).toBe(true);
  });

  it("blocks when budget is exceeded", async () => {
    const engine = new BusinessRulesEngine();
    const rep = await engine.evaluate({ ...baseCtx, budgetRemainingCents: 10 });
    expect(rep.outcome).toBe("block");
  });

  it("blocks when plan disallows kind", async () => {
    const engine = new BusinessRulesEngine();
    const rep = await engine.evaluate({
      ...baseCtx, plan: "free",
      request: { ...baseRequest, kind: "workflow" },
    });
    expect(rep.outcome).toBe("block");
  });

  it("warns when maxSteps exceeds SLO", async () => {
    const engine = new BusinessRulesEngine();
    const rep = await engine.evaluate({
      ...baseCtx,
      request: { ...baseRequest, constraints: { ...baseRequest.constraints, maxSteps: 40 } },
    });
    expect(rep.outcome).toBe("warn");
  });

  it("exposes deterministic rule fingerprints", () => {
    const engine = new BusinessRulesEngine();
    const fps = engine.list().map((r) => r.fingerprint);
    for (const fp of fps) expect(fp).toMatch(/^[0-9a-f]{16}$/);
    expect(new Set(fps).size).toBe(fps.length);
  });
});
