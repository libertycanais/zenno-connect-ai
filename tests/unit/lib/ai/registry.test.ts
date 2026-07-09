// P0.6 · Onda 3 — Provider Registry
import { describe, expect, it } from "vitest";
import { ProviderRegistry, providerRegistry } from "@/lib/ai/registry";

describe("Provider Registry", () => {
  it("seeds the 5 default providers", () => {
    const ids = providerRegistry.list().map((p) => p.providerId).sort();
    expect(ids).toEqual(["anthropic", "deepseek", "google", "openai", "xai"]);
  });

  it("findModel returns undefined for unknown pair", () => {
    expect(providerRegistry.findModel("openai", "nope")).toBeUndefined();
    expect(providerRegistry.findModel("nope", "gpt-5.5")).toBeUndefined();
  });

  it("allModels enumerates every registered model", () => {
    const rows = providerRegistry.allModels();
    expect(rows.length).toBeGreaterThanOrEqual(9);
    expect(rows.every((r) => r.model.costInputPerMTokCents > 0)).toBe(true);
  });

  it("setStatus mutates only the target provider", () => {
    const reg = new ProviderRegistry();
    reg.setStatus("openai", "degraded");
    expect(reg.get("openai")!.status).toBe("degraded");
    expect(reg.get("anthropic")!.status).toBe("online");
  });

  it("register overwrites existing entries", () => {
    const reg = new ProviderRegistry();
    reg.register({
      providerId: "openai",
      displayName: "custom",
      status: "offline",
      priority: 1,
      supportedModels: [],
    });
    expect(reg.get("openai")!.displayName).toBe("custom");
  });
});
