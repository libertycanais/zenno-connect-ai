import { describe, it, expect } from "vitest";
import { Planner } from "@/lib/ai/planner";
import { BusinessRulesEngine } from "@/lib/ai/rules";
import type { PlanRequest } from "@/lib/ai/planner";
import type { RuleContext } from "@/lib/ai/rules";

const request: PlanRequest = {
  organizationId: "org-1",
  userId: "user-1",
  agent: "campaign_analyst",
  kind: "analysis",
  objective: "Otimizar ROAS Meta Ads",
  requiredContext: ["ads", "tracking"],
  constraints: {
    maxCostCents: 1000,
    maxLatencyMs: 20000,
    maxSteps: 10,
    requiredCapabilities: [],
  },
  priority: "normal",
  featureFlags: ["enablePlanner"],
};

async function reportFor(req = request) {
  const engine = new BusinessRulesEngine();
  const ctx: RuleContext = {
    organizationId: req.organizationId, userId: req.userId, agent: req.agent,
    plan: "pro", role: "analyst", featureFlags: ["enablePlanner"],
    budgetRemainingCents: 100000, request: req,
  };
  return engine.evaluate(ctx);
}

describe("Planner", () => {
  it("returns a structured plan with fingerprint", async () => {
    const rulesReport = await reportFor();
    const res = new Planner().build({ request, rulesReport, plan: "pro", role: "analyst" });
    expect(res.ok).toBe(true);
    expect(res.plan?.steps.length).toBeGreaterThan(0);
    expect(res.plan?.fingerprint).toMatch(/^[0-9a-f]{16}$/);
    expect(res.plan?.totalCostCents).toBeGreaterThanOrEqual(0);
  });

  it("rejects when rules block", async () => {
    const rulesReport = await reportFor({ ...request, featureFlags: [] });
    // rulesReport is derived from a passing-flag context above, so simulate
    // blocking manually:
    const res = new Planner().build({
      request, rulesReport: { ...rulesReport, outcome: "block", blockingReasons: ["x"] },
      plan: "pro", role: "analyst",
    });
    expect(res.ok).toBe(false);
    expect(res.reasonCode).toBe("rules_blocked");
  });

  it("rejects when cost exceeds constraint", async () => {
    const tight = { ...request, constraints: { ...request.constraints, maxCostCents: 0 } };
    const rulesReport = await reportFor(tight);
    const res = new Planner().build({ request: tight, rulesReport, plan: "pro", role: "analyst" });
    expect(res.ok).toBe(false);
    expect(res.reasonCode).toBe("cost_budget");
  });

  it("produces deterministic fingerprints for identical inputs", async () => {
    const rulesReport = await reportFor();
    const a = new Planner().build({ request, rulesReport, plan: "pro", role: "analyst" });
    const b = new Planner().build({ request, rulesReport, plan: "pro", role: "analyst" });
    expect(a.plan?.fingerprint).toBe(b.plan?.fingerprint);
  });
});
