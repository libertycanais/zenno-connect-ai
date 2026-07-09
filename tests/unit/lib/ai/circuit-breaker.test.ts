import { describe, expect, it, vi } from "vitest";
import { CircuitBreaker, breakerKey } from "@/lib/ai/resilience/circuit-breaker";

describe("CircuitBreaker", () => {
  it("opens after threshold consecutive failures", () => {
    const cb = new CircuitBreaker({ failureThreshold: 3, cooldownMs: 1000, halfOpenMaxProbes: 1 });
    const k = breakerKey("openai", "gpt-5.5");
    for (let i = 0; i < 3; i++) cb.onFailure(k);
    expect(cb.isOpen(k)).toBe(true);
    expect(cb.snapshot(k).state).toBe("open");
  });

  it("transitions open → half_open after cooldown, then closed on success", () => {
    let now = 1_000_000;
    const cb = new CircuitBreaker({ failureThreshold: 2, cooldownMs: 500, halfOpenMaxProbes: 1, now: () => now });
    const k = "p:m";
    cb.onFailure(k); cb.onFailure(k);
    expect(cb.isOpen(k)).toBe(true);
    now += 501;
    expect(cb.isOpen(k)).toBe(false);
    expect(cb.snapshot(k).state).toBe("half_open");
    cb.onSuccess(k);
    expect(cb.snapshot(k).state).toBe("closed");
  });

  it("half_open failure re-opens immediately", () => {
    let now = 0;
    const cb = new CircuitBreaker({ failureThreshold: 1, cooldownMs: 10, halfOpenMaxProbes: 2, now: () => now });
    const k = "p:m";
    cb.onFailure(k);
    now = 20;
    cb.isOpen(k); // triggers transition to half_open
    cb.onFailure(k);
    expect(cb.snapshot(k).state).toBe("open");
  });

  it("success resets consecutive failure counter in closed state", () => {
    const cb = new CircuitBreaker({ failureThreshold: 3, cooldownMs: 10, halfOpenMaxProbes: 1 });
    cb.onFailure("k"); cb.onFailure("k");
    cb.onSuccess("k");
    expect(cb.snapshot("k").consecutiveFailures).toBe(0);
  });

  it("keys are isolated per provider:model", () => {
    const cb = new CircuitBreaker({ failureThreshold: 1, cooldownMs: 10, halfOpenMaxProbes: 1 });
    cb.onFailure("openai:gpt-5.5");
    expect(cb.isOpen("openai:gpt-5.5")).toBe(true);
    expect(cb.isOpen("anthropic:claude")).toBe(false);
  });
});
