// P0.6 · Onda 1 — normalizeAIError + scrubSecrets
import { describe, expect, it } from "vitest";
import { AIError, normalizeAIError, scrubSecrets, policyBlocked, budgetExceeded } from "@/lib/ai/errors";

describe("scrubSecrets", () => {
  it("redacts OpenAI-style keys", () => {
    expect(scrubSecrets("Error: bad key sk-abcdef1234567890XYZ blah")).not.toContain("sk-abcdef");
  });
  it("redacts Anthropic-style keys", () => {
    expect(scrubSecrets("sk-ant-1234567890abcdefgh oh no")).not.toContain("sk-ant-1");
  });
  it("redacts bearer tokens", () => {
    expect(scrubSecrets("Authorization: Bearer abcdef.ghijkl.mnopqr")).not.toMatch(/Bearer\s+[A-Za-z]/);
  });
  it("redacts key=value pairs", () => {
    expect(scrubSecrets("api_key=SECRETVAL")).toContain("[REDACTED]");
  });
});

describe("normalizeAIError", () => {
  it("maps 429 → RATE_LIMITED, retryable", () => {
    const e = normalizeAIError({ status: 429, message: "rate limited" });
    expect(e.code).toBe("RATE_LIMITED");
    expect(e.retryable).toBe(true);
  });
  it("maps 401 → INVALID_KEY, non-retryable", () => {
    expect(normalizeAIError({ status: 401, message: "unauthorized" }).code).toBe("INVALID_KEY");
  });
  it("maps abort → TIMEOUT", () => {
    const err = new Error("aborted");
    err.name = "AbortError";
    expect(normalizeAIError(err).code).toBe("TIMEOUT");
  });
  it("maps 5xx → UPSTREAM_5XX", () => {
    expect(normalizeAIError({ status: 502, message: "bad gateway" }).code).toBe("UPSTREAM_5XX");
  });
  it("maps content filter → CONTENT_FILTER", () => {
    expect(normalizeAIError(new Error("content_filter triggered")).code).toBe("CONTENT_FILTER");
  });
  it("never leaks raw API keys in userMessage", () => {
    const e = normalizeAIError(new Error("bad key sk-abcdef1234567890XYZ"));
    expect(e.userMessage).not.toContain("sk-abcdef");
  });
  it("caps message length at 500", () => {
    const long = "x".repeat(2000);
    const e = normalizeAIError(new Error(long));
    expect(e.userMessage.length).toBeLessThanOrEqual(500);
  });
});

describe("AIError helpers", () => {
  it("policyBlocked carries subCode", () => {
    const e = policyBlocked("PLAN_FEATURE_DISABLED", "no ai");
    expect(e).toBeInstanceOf(AIError);
    expect(e.normalized.code).toBe("POLICY_BLOCKED");
    expect(e.normalized.subCode).toBe("PLAN_FEATURE_DISABLED");
  });
  it("budgetExceeded has BUDGET_EXCEEDED code", () => {
    expect(budgetExceeded().normalized.code).toBe("BUDGET_EXCEEDED");
  });
});
