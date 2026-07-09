import { describe, it, expect } from "vitest";
import { FeatureFlagRegistry } from "@/lib/ai/feature-flags";
import type { FeatureFlagContext } from "@/lib/ai/feature-flags";

const ctx = (over: Partial<FeatureFlagContext> = {}): FeatureFlagContext => ({
  environment: "production",
  organizationId: "org-1",
  userId: "user-1",
  plan: "pro",
  agent: null,
  ...over,
});

describe("FeatureFlagRegistry", () => {
  it("enables default flags on pro plan", () => {
    const r = new FeatureFlagRegistry();
    expect(r.isEnabled("enablePlanner", ctx()).enabled).toBe(true);
    expect(r.isEnabled("enableForecast", ctx()).enabled).toBe(true);
  });

  it("respects plan allowlist", () => {
    const r = new FeatureFlagRegistry();
    const res = r.isEnabled("enableForecast", ctx({ plan: "free" }));
    expect(res.enabled).toBe(false);
    expect(res.reason).toContain("plan_not_allowed");
  });

  it("respects environment restriction", () => {
    const r = new FeatureFlagRegistry();
    expect(r.isEnabled("enableConsensus", ctx({ environment: "production" })).enabled).toBe(false);
    expect(r.isEnabled("enableConsensus", ctx({ environment: "development" })).enabled).toBe(true);
  });

  it("snapshot separates active from denied with reasons", () => {
    const r = new FeatureFlagRegistry();
    const snap = r.snapshot(ctx({ plan: "free" }));
    expect(snap.active.length + snap.denied.length).toBeGreaterThan(0);
    for (const d of snap.denied) expect(d.reason).toMatch(/./);
  });

  it("upserts a new rule", () => {
    const r = new FeatureFlagRegistry([]);
    r.upsert({ key: "enablePlanner", enabled: true });
    expect(r.isEnabled("enablePlanner", ctx()).enabled).toBe(true);
  });
});
