import { describe, expect, it } from "vitest";
import { validateCapability, assertCapability } from "@/lib/ai/validators/capability";
import { ProviderRegistry } from "@/lib/ai/registry";

const reg = new ProviderRegistry();

describe("validateCapability", () => {
  it("passes when model exists and no requirements are set", () => {
    const r = validateCapability("openai", "gpt-5.5", {}, reg);
    expect(r.ok).toBe(true);
  });

  it("fails when model is unknown", () => {
    const r = validateCapability("openai", "unknown-model", {}, reg);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.missing).toContain("model");
  });

  it("fails when required capability is missing", () => {
    const r = validateCapability("deepseek", "deepseek-reasoner", { needsTools: true }, reg);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.missing).toContain("tools");
  });

  it("fails when context window is insufficient", () => {
    const r = validateCapability("xai", "grok-2-latest", { minContextTokens: 1_000_000 }, reg);
    expect(r.ok).toBe(false);
  });

  it("assertCapability throws INVALID_INPUT on failure", () => {
    expect(() => assertCapability("openai", "nope", {}, reg)).toThrow();
  });
});
