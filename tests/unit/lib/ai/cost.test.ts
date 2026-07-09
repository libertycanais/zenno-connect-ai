// P0.6 · Onda 3 — Cost Optimizer
import { describe, expect, it } from "vitest";
import { ProviderRegistry } from "@/lib/ai/registry";
import { compareModels, suggestCheaperAlternative, estimateTokensFromText } from "@/lib/ai/cost";

describe("Cost Optimizer", () => {
  it("estimateTokensFromText is ~len/4", () => {
    expect(estimateTokensFromText("abcdefgh")).toBe(2);
    expect(estimateTokensFromText("")).toBe(1);
  });

  it("compareModels sorts by estimated cost ascending", () => {
    const rows = compareModels(new ProviderRegistry(), 10_000, 3_000);
    for (let i = 1; i < rows.length; i++) {
      expect(rows[i]!.estimatedCostCents).toBeGreaterThanOrEqual(rows[i - 1]!.estimatedCostCents);
    }
  });

  it("suggestCheaperAlternative returns null for unknown model", () => {
    expect(suggestCheaperAlternative(new ProviderRegistry(), "x", "y", 100, 100)).toBeNull();
  });

  it("suggestCheaperAlternative returns null when nothing cheaper", () => {
    const reg = new ProviderRegistry();
    // DeepSeek chat is cheapest — no cheaper alternative
    const s = suggestCheaperAlternative(reg, "deepseek", "deepseek-chat", 10_000, 3_000);
    expect(s).toBeNull();
  });

  it("suggests cheaper alternative to GPT-5.5", () => {
    const reg = new ProviderRegistry();
    const s = suggestCheaperAlternative(reg, "openai", "gpt-5.5", 10_000, 3_000);
    expect(s).not.toBeNull();
    if (!s) return;
    expect(s.to.costCents).toBeLessThan(s.from.costCents);
    expect(s.savingsPct).toBeGreaterThan(0);
  });
});
