// P0.6 · Onda 1 — Orchestrator pipeline (with injected deps)
import { describe, expect, it, vi } from "vitest";
import { runOrchestrator } from "@/lib/ai/orchestrator";
import type { PolicyInput } from "@/lib/ai/policy";

const baseInput = {
  organizationId: "org-1",
  userId: "user-1",
  agent: "free_chat" as const,
  provider: "openai" as const,
  model: "gpt-5.5",
  userInput: "Analise minhas campanhas",
};

const openPolicy = async (): Promise<PolicyInput> => ({
  organizationId: "org-1",
  userId: "user-1",
  provider: "openai",
  model: "gpt-5.5",
  estimatedCostCents: 1,
  featureFlagEnabled: true,
  subscription: {
    status: "active",
    plan: "pro",
    ai_enabled: true,
    monthly_budget_cents: 100_000,
    monthly_spent_cents: 0,
    daily_budget_cents: 10_000,
    daily_spent_cents: 0,
    allowed_providers: ["openai"],
    allowed_models: null,
  },
  rateLimit: {
    user_messages_last_minute: 0,
    org_messages_last_minute: 0,
    user_limit_per_minute: 20,
    org_limit_per_minute: 120,
  },
});

describe("runOrchestrator", () => {
  it("executes the happy path and post-processes JSON output", async () => {
    const executeProvider = vi.fn().mockResolvedValue({
      text: '{"summary":"ok","priority":"medium","confidence":0.9}',
      tokensIn: 100,
      tokensOut: 20,
    });
    const result = await runOrchestrator(baseInput, {
      policyInputBuilder: openPolicy,
      executeProvider,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.response.summary).toBe("ok");
      expect(result.usage.tokensIn).toBe(100);
    }
  });

  it("aborts when policy denies (never calls provider)", async () => {
    const executeProvider = vi.fn();
    const result = await runOrchestrator(baseInput, {
      policyInputBuilder: async () => ({
        ...(await openPolicy()),
        subscription: { ...(await openPolicy()).subscription, ai_enabled: false },
      }),
      executeProvider,
    });
    expect(result.ok).toBe(false);
    expect(executeProvider).not.toHaveBeenCalled();
    if (!result.ok) expect(result.error.code).toBe("POLICY_BLOCKED");
  });

  it("normalizes provider errors", async () => {
    const executeProvider = vi.fn().mockRejectedValue({ status: 429, message: "rate limited" });
    const result = await runOrchestrator(baseInput, {
      policyInputBuilder: openPolicy,
      executeProvider,
    });
    if (!result.ok) expect(result.error.code).toBe("RATE_LIMITED");
  });

  it("times out via AbortController", async () => {
    const executeProvider = vi.fn(async ({ signal }: { signal: AbortSignal }) => {
      await new Promise((_, reject) => {
        signal.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
      });
      return { text: "", tokensIn: 0, tokensOut: 0 };
    });
    const result = await runOrchestrator(baseInput, {
      policyInputBuilder: openPolicy,
      executeProvider,
      timeoutMs: 20,
    });
    if (!result.ok) expect(result.error.code).toBe("TIMEOUT");
  });

  it("never leaks raw error text through the pipeline", async () => {
    const executeProvider = vi.fn().mockRejectedValue(new Error("bad key sk-abcdef1234567890XYZ"));
    const result = await runOrchestrator(baseInput, { policyInputBuilder: openPolicy, executeProvider });
    if (!result.ok) expect(result.error.userMessage).not.toContain("sk-abcdef");
  });
});
