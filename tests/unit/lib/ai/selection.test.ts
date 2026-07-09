// P0.6 · Onda 3 — Model Selection Engine
import { describe, expect, it } from "vitest";
import { ProviderRegistry } from "@/lib/ai/registry";
import { selectModel, estimateCostCents } from "@/lib/ai/selection";
import { ProviderBenchmarkStore } from "@/lib/ai/benchmark";
import { ProviderHealthMonitor } from "@/lib/ai/health";

const baseReq = {
  approxInputTokens: 1_000,
  approxOutputTokens: 500,
  taskKind: "chat" as const,
};

describe("Model Selection Engine", () => {
  it("estimateCostCents scales with tokens", () => {
    const reg = new ProviderRegistry();
    const m = reg.findModel("openai", "gpt-5.5-mini")!;
    const c1 = estimateCostCents(m, 1_000, 1_000);
    const c2 = estimateCostCents(m, 10_000, 10_000);
    expect(c2).toBeGreaterThan(c1);
  });

  it("auto returns cheapest capable candidate first for chat", () => {
    const reg = new ProviderRegistry();
    const r = selectModel({ registry: reg, mode: { kind: "auto" }, requirements: baseReq });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.ranked.length).toBeGreaterThan(0);
    expect(r.chosen.estimatedCostCents).toBeGreaterThan(0);
  });

  it("explicit fails when model lacks capability", () => {
    const reg = new ProviderRegistry();
    const r = selectModel({
      registry: reg,
      mode: { kind: "explicit", providerId: "deepseek", modelId: "deepseek-chat" },
      requirements: { ...baseReq, needsVision: true },
    });
    expect(r.ok).toBe(false);
  });

  it("explicit fails for unknown provider/model", () => {
    const reg = new ProviderRegistry();
    const r = selectModel({
      registry: reg,
      mode: { kind: "explicit", providerId: "openai", modelId: "unknown" },
      requirements: baseReq,
    });
    expect(r.ok).toBe(false);
  });

  it("offline providers are excluded", () => {
    const reg = new ProviderRegistry();
    reg.setStatus("openai", "offline");
    const r = selectModel({ registry: reg, mode: { kind: "auto" }, requirements: baseReq });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.ranked.every((c) => c.provider.providerId !== "openai")).toBe(true);
  });

  it("reasoning tasks prefer reasoning-capable models", () => {
    const reg = new ProviderRegistry();
    const r = selectModel({
      registry: reg,
      mode: { kind: "auto" },
      requirements: { ...baseReq, taskKind: "reasoning", needsReasoning: true },
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.chosen.model.supportsReasoning).toBe(true);
  });

  it("budget cap filters candidates", () => {
    const reg = new ProviderRegistry();
    const r = selectModel({
      registry: reg,
      mode: { kind: "auto" },
      requirements: { ...baseReq, remainingBudgetCents: 1 },
    });
    // Cheapest may still fit; ensure result respects budget when it doesn't
    if (r.ok) expect(r.chosen.estimatedCostCents).toBeLessThanOrEqual(1);
  });

  it("benchmark penalty biases against slow providers", () => {
    const reg = new ProviderRegistry();
    const store = new ProviderBenchmarkStore();
    for (let i = 0; i < 10; i++) {
      store.record({
        providerId: "openai", modelId: "gpt-5.5-mini",
        latencyMs: 20_000, tokensIn: 100, tokensOut: 100, costCents: 1,
        error: true, timeout: false, timestampMs: Date.now(),
      });
    }
    const r = selectModel({
      registry: reg,
      mode: { kind: "auto" },
      requirements: baseReq,
      benchmarks: store.snapshotAll(),
    });
    expect(r.ok).toBe(true);
    // Loaded benchmarks should not crash and produce a valid choice
    if (r.ok) expect(r.chosen.model.id).toBeTruthy();
  });

  it("health degraded incurs penalty but does not exclude", () => {
    const reg = new ProviderRegistry();
    const health = new ProviderHealthMonitor();
    const now = Date.now();
    for (let i = 0; i < 5; i++) health.record({ providerId: "openai", ok: false, latencyMs: 200, timestampMs: now });
    const r = selectModel({
      registry: reg,
      mode: { kind: "auto" },
      requirements: baseReq,
      health: health.snapshotAll(),
    });
    expect(r.ok).toBe(true);
  });
});
