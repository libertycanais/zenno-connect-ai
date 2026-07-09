// P0.6 · Onda 3 — Usage Collector
import { describe, expect, it, vi } from "vitest";
import { UsageCollector, type UsageRecord } from "@/lib/ai/usage";
import { providerBenchmark } from "@/lib/ai/benchmark";

function rec(over: Partial<UsageRecord> = {}): UsageRecord {
  return {
    organizationId: "o", userId: "u", conversationId: null, taskId: null,
    provider: "openai", model: "gpt-5.5-mini",
    tokensIn: 100, tokensOut: 50, latencyMs: 500, streaming: false,
    costCents: 3, status: "succeeded", timestampMs: Date.now(), ...over,
  };
}

describe("Usage Collector", () => {
  it("buffers records and drains", async () => {
    const c = new UsageCollector();
    await c.record(rec());
    await c.record(rec({ status: "failed" }));
    const drained = c.drain();
    expect(drained).toHaveLength(2);
    expect(c.drain()).toHaveLength(0);
  });

  it("invokes sink for each record", async () => {
    const persist = vi.fn().mockResolvedValue(undefined);
    const c = new UsageCollector({ persist });
    await c.record(rec());
    expect(persist).toHaveBeenCalledTimes(1);
  });

  it("feeds benchmark aggregation", async () => {
    providerBenchmark.reset();
    const c = new UsageCollector();
    await c.record(rec({ provider: "anthropic", model: "claude-3-5-haiku-latest" }));
    const s = providerBenchmark.snapshot("anthropic", "claude-3-5-haiku-latest");
    expect(s.samples).toBe(1);
  });

  it("caps buffer to bufferCap", async () => {
    const c = new UsageCollector(undefined, 5);
    for (let i = 0; i < 20; i++) await c.record(rec());
    expect(c.peek().length).toBe(5);
  });
});
