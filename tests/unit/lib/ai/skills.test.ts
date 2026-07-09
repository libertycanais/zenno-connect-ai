// P0.6 · Onda 3 — Skill Registry
import { describe, expect, it } from "vitest";
import { SkillRegistry, skillRegistry } from "@/lib/ai/skills";

describe("Skill Registry", () => {
  it("seeds the 10 default skills", () => {
    expect(skillRegistry.list()).toHaveLength(10);
  });

  it("get returns descriptor by id", () => {
    expect(skillRegistry.get("campaign_analysis")?.category).toBe("campaigns");
    expect(skillRegistry.get("nope")).toBeUndefined();
  });

  it("listByCategory filters", () => {
    expect(skillRegistry.listByCategory("executive").map((s) => s.id)).toEqual(["executive_summary"]);
  });

  it("register overrides existing skill", () => {
    const reg = new SkillRegistry();
    reg.register({
      id: "campaign_analysis",
      category: "campaigns",
      displayName: "custom",
      description: "d",
      requiredContext: [],
      suggestedModels: [],
      needsReasoning: false, needsVision: false, needsTools: false,
      estimatedInputTokens: 1, estimatedOutputTokens: 1,
    });
    expect(reg.get("campaign_analysis")!.displayName).toBe("custom");
  });
});
