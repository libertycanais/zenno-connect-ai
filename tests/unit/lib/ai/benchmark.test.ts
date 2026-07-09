// P0.6 · Onda 3 — Benchmark
import { describe, expect, it } from "vitest";
import { ProviderBenchmarkStore } from "@/lib/ai/benchmark";

describe("Provider Benchmark", () => {
  it("empty snapshot has zeroed metrics", () => {
    const s = new ProviderBenchmarkStore().snapshot("openai", "gpt-5.5");
    expect(s.samples).toBe(0);
    expect(s.availability01).toBe(1);
  });

  it("computes p50/p95 and error rate", () => {
    const b = new ProviderBenchmarkStore();
    const now = Date.now();
    for (let i = 1; i <= 100; i++) {
      b.record({
        providerId: "openai", modelId: "gpt-5.5",
        latencyMs: i * 10, tokensIn: 100, tokensOut: 100, costCents: 5,
        error: i % 10 === 0, timeout: false, timestampMs: now,
      });
    }
    const s = b.snapshot("openai", "gpt-5.5");
    expect(s.samples).toBe(100);
    expect(s.p50LatencyMs).toBeGreaterThan(0);
    expect(s.p95LatencyMs).toBeGreaterThan(s.p50LatencyMs);
    expect(s.errorRate01).toBeCloseTo(0.1, 5);
  });

  it("caps samples at maxSamplesPerKey", () => {
    const b = new ProviderBenchmarkStore(10);
    for (let i = 0; i < 50; i++) {
      b.record({
        providerId: "x", modelId: "y",
        latencyMs: 1, tokensIn: 1, tokensOut: 1, costCents: 1,
        error: false, timeout: false, timestampMs: Date.now(),
      });
    }
    expect(b.snapshot("x", "y").samples).toBe(10);
  });

  it("averages user feedback when present", () => {
    const b = new ProviderBenchmarkStore();
    for (const score of [1, 1, -1, 0]) {
      b.record({
        providerId: "openai", modelId: "gpt-5.5",
        latencyMs: 100, tokensIn: 1, tokensOut: 1, costCents: 1,
        error: false, timeout: false, timestampMs: Date.now(),
        feedbackScore: score,
      });
    }
    expect(b.snapshot("openai", "gpt-5.5").avgFeedback).toBeCloseTo(0.25, 5);
  });
});
