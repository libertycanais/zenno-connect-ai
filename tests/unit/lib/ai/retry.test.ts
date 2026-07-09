import { describe, expect, it, vi } from "vitest";
import { withRetry, computeDelay, isRetryable, DEFAULT_RETRY } from "@/lib/ai/resilience/retry";
import { AIError } from "@/lib/ai/errors";

describe("withRetry", () => {
  it("returns on first success without sleeping", async () => {
    const sleep = vi.fn().mockResolvedValue(undefined);
    const fn = vi.fn().mockResolvedValue("ok");
    const out = await withRetry(fn, DEFAULT_RETRY, { sleep });
    expect(out).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });

  it("retries retryable errors up to maxAttempts", async () => {
    const sleep = vi.fn().mockResolvedValue(undefined);
    const fn = vi.fn()
      .mockRejectedValueOnce({ status: 503, message: "upstream" })
      .mockRejectedValueOnce({ status: 503, message: "upstream" })
      .mockResolvedValue("ok");
    const out = await withRetry(fn, { ...DEFAULT_RETRY, maxAttempts: 3 }, { sleep, rnd: () => 0 });
    expect(out).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(3);
    expect(sleep).toHaveBeenCalledTimes(2);
  });

  it("does not retry non-retryable errors", async () => {
    const sleep = vi.fn();
    const fn = vi.fn().mockRejectedValue(
      new AIError({ code: "POLICY_BLOCKED", retryable: false, userMessage: "blocked" }),
    );
    await expect(withRetry(fn, DEFAULT_RETRY, { sleep })).rejects.toBeDefined();
    expect(fn).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });

  it("throws after last attempt", async () => {
    const sleep = vi.fn().mockResolvedValue(undefined);
    const fn = vi.fn().mockRejectedValue({ status: 500, message: "boom" });
    await expect(withRetry(fn, { ...DEFAULT_RETRY, maxAttempts: 2 }, { sleep })).rejects.toBeDefined();
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("aborts via AbortSignal", async () => {
    const ac = new AbortController();
    ac.abort();
    await expect(withRetry(() => Promise.resolve("x"), DEFAULT_RETRY, { signal: ac.signal }))
      .rejects.toBeInstanceOf(DOMException);
  });

  it("computeDelay honors cap and jitter", () => {
    const noJitter = computeDelay(5, { ...DEFAULT_RETRY, jitter: "none", baseDelayMs: 100, maxDelayMs: 500 });
    expect(noJitter).toBe(500);
    const full = computeDelay(3, { ...DEFAULT_RETRY, jitter: "full", baseDelayMs: 100, maxDelayMs: 10_000 }, () => 0.5);
    expect(full).toBeLessThanOrEqual(400);
  });

  it("isRetryable respects normalized codes", () => {
    expect(isRetryable({ code: "RATE_LIMITED", retryable: true, userMessage: "" })).toBe(true);
    expect(isRetryable({ code: "POLICY_BLOCKED", retryable: false, userMessage: "" })).toBe(false);
    expect(isRetryable({ code: "INVALID_KEY", retryable: false, userMessage: "" })).toBe(false);
  });
});
