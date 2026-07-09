// P0.6 · Onda 1 — Policy Engine
import { describe, expect, it } from "vitest";
import { evaluatePolicy, type PolicyInput } from "@/lib/ai/policy";

const baseline: PolicyInput = {
  organizationId: "org-1",
  userId: "user-1",
  provider: "openai",
  model: "gpt-5.5",
  estimatedCostCents: 10,
  featureFlagEnabled: true,
  subscription: {
    status: "active",
    plan: "pro",
    ai_enabled: true,
    monthly_budget_cents: 10_000,
    monthly_spent_cents: 100,
    daily_budget_cents: 1000,
    daily_spent_cents: 50,
    allowed_providers: ["openai", "anthropic", "lovable"],
    allowed_models: null,
  },
  rateLimit: {
    user_messages_last_minute: 0,
    org_messages_last_minute: 0,
    user_limit_per_minute: 20,
    org_limit_per_minute: 120,
  },
};

describe("Policy Engine", () => {
  it("allows a well-formed request", () => {
    expect(evaluatePolicy(baseline).allowed).toBe(true);
  });

  it("blocks when subscription is canceled", () => {
    const d = evaluatePolicy({ ...baseline, subscription: { ...baseline.subscription, status: "canceled" } });
    expect(d.allowed).toBe(false);
    if (!d.allowed) expect(d.error.subCode).toBe("SUBSCRIPTION_INACTIVE");
  });

  it("blocks when plan disables AI", () => {
    const d = evaluatePolicy({ ...baseline, subscription: { ...baseline.subscription, ai_enabled: false } });
    if (!d.allowed) expect(d.error.subCode).toBe("PLAN_FEATURE_DISABLED");
  });

  it("blocks disallowed provider", () => {
    const d = evaluatePolicy({ ...baseline, provider: "xai" });
    if (!d.allowed) expect(d.error.subCode).toBe("PROVIDER_NOT_ALLOWED");
  });

  it("blocks disallowed model when list is set", () => {
    const d = evaluatePolicy({
      ...baseline,
      subscription: { ...baseline.subscription, allowed_models: ["gpt-4o"] },
    });
    if (!d.allowed) expect(d.error.subCode).toBe("MODEL_NOT_ALLOWED");
  });

  it("blocks when monthly hard cap would be exceeded", () => {
    const d = evaluatePolicy({
      ...baseline,
      estimatedCostCents: 20_000,
    });
    if (!d.allowed) {
      expect(d.error.code).toBe("BUDGET_EXCEEDED");
      expect(d.error.subCode).toBe("BUDGET_EXCEEDED_MONTHLY");
    }
  });

  it("blocks when daily cap would be exceeded", () => {
    const d = evaluatePolicy({ ...baseline, estimatedCostCents: 2000 });
    if (!d.allowed) expect(d.error.subCode).toBe("BUDGET_EXCEEDED_DAILY");
  });

  it("blocks when user rate limit is reached", () => {
    const d = evaluatePolicy({
      ...baseline,
      rateLimit: { ...baseline.rateLimit, user_messages_last_minute: 20 },
    });
    if (!d.allowed) expect(d.error.subCode).toBe("RATE_LIMIT_USER");
  });

  it("blocks when org rate limit is reached", () => {
    const d = evaluatePolicy({
      ...baseline,
      rateLimit: { ...baseline.rateLimit, org_messages_last_minute: 120 },
    });
    if (!d.allowed) expect(d.error.subCode).toBe("RATE_LIMIT_ORG");
  });

  it("blocks when feature flag is disabled", () => {
    const d = evaluatePolicy({ ...baseline, featureFlagEnabled: false });
    if (!d.allowed) expect(d.error.subCode).toBe("FEATURE_FLAG_DISABLED");
  });
});
