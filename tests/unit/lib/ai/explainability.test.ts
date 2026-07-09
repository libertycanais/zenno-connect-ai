// P0.6 · Onda 3 — Explainability
import { describe, expect, it } from "vitest";
import { attachExplainability, classifyFreshness, explainabilitySchema } from "@/lib/ai/explainability";
import { postProcess } from "@/lib/ai/post-processor";

describe("Explainability", () => {
  it("classifyFreshness buckets", () => {
    expect(classifyFreshness(1_000)).toBe("realtime");
    expect(classifyFreshness(10 * 60_000)).toBe("fresh");
    expect(classifyFreshness(60 * 60_000)).toBe("stale");
    expect(classifyFreshness(24 * 60 * 60_000)).toBe("unknown");
  });

  it("attaches metadata to a structured response", () => {
    const resp = postProcess("Resumo teste");
    const wrapped = attachExplainability(resp, {
      confidence: 0.7,
      sources: [{ module: "billing", label: "MRR", freshnessAgeMs: 30_000 }],
      reasoningSummary: null,
      contextUsedModules: ["billing"],
      contextTokens: 512,
      provider: "openai",
      model: "gpt-5.5",
      latencyMs: 800,
      costCents: 4,
    });
    expect(wrapped.response.summary).toContain("Resumo");
    expect(wrapped.explainability.freshness).toBe("unknown");
    expect(wrapped.explainability.sources[0]!.module).toBe("billing");
  });

  it("schema rejects invalid confidence", () => {
    expect(() => explainabilitySchema.parse({
      confidence: 2, sources: [], reasoningSummary: null,
      contextUsedModules: [], contextTokens: 0,
      provider: "x", model: "y", latencyMs: 0, costCents: 0,
    })).toThrow();
  });
});
