import { describe, it, expect } from "vitest";
import { CapabilityMatrix, capabilityMatrix } from "@/lib/ai/capability-matrix";

describe("CapabilityMatrix", () => {
  it("filters by plan and role tier", () => {
    const m = capabilityMatrix.match({
      skill: "campaign_analysis",
      agent: "campaign_analyst",
      plan: "starter",
      role: "analyst",
    });
    expect(m.length).toBeGreaterThan(0);
    expect(m[0].provider).toBe("anthropic");
  });

  it("blocks when plan is below required tier", () => {
    const m = capabilityMatrix.match({
      skill: "executive_summary",
      agent: "executive_advisor",
      plan: "free",
      role: "admin",
    });
    expect(m).toEqual([]);
  });

  it("blocks when role tier is below requirement", () => {
    const m = capabilityMatrix.match({
      skill: "campaign_analysis",
      agent: "campaign_analyst",
      plan: "starter",
      role: "viewer",
    });
    expect(m).toEqual([]);
  });

  it("orders by cost+latency score", () => {
    const custom = new CapabilityMatrix();
    custom.registerMany([
      { provider: "openai", model: "cheap", skill: "s", requiredPlan: "free", requiredRole: "viewer",
        requiresRule: null, supportsAgents: ["free_chat"], costRankPerMTokCents: 10, latencyRankMs: 200, active: true },
      { provider: "anthropic", model: "expensive", skill: "s", requiredPlan: "free", requiredRole: "viewer",
        requiresRule: null, supportsAgents: ["free_chat"], costRankPerMTokCents: 4000, latencyRankMs: 4000, active: true },
    ]);
    const m = custom.match({ skill: "s", agent: "free_chat", plan: "free", role: "viewer" });
    expect(m[0].provider).toBe("openai");
    expect(m[1].provider).toBe("anthropic");
  });

  it("respects allowedProviders", () => {
    const m = capabilityMatrix.match({
      skill: "campaign_analysis",
      agent: "campaign_analyst",
      plan: "starter",
      role: "analyst",
      allowedProviders: ["openai"],
    });
    expect(m).toEqual([]);
  });
});
