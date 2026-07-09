import { describe, expect, it } from "vitest";
import { PromptRegistry, fingerprintPrompt } from "@/lib/ai/prompts/versioning";

describe("PromptRegistry", () => {
  it("registers and returns active version", async () => {
    const r = new PromptRegistry();
    await r.register("k", "1.0.0", "Hello");
    const active = r.active("k");
    expect(active?.version).toBe("1.0.0");
    expect(active?.fingerprint).toHaveLength(16);
  });

  it("is immutable — cannot re-register the same version", async () => {
    const r = new PromptRegistry();
    await r.register("k", "1.0.0", "a");
    await expect(r.register("k", "1.0.0", "b")).rejects.toThrow(/immutable/i);
  });

  it("activate switches active pointer, history retains all", async () => {
    const r = new PromptRegistry();
    await r.register("k", "1.0.0", "a");
    await r.register("k", "1.1.0", "b");
    expect(r.active("k")?.version).toBe("1.0.0");
    r.activate("k", "1.1.0");
    expect(r.active("k")?.version).toBe("1.1.0");
    expect(r.history("k")).toHaveLength(2);
  });

  it("fingerprint changes with content", async () => {
    const a = await fingerprintPrompt("hello");
    const b = await fingerprintPrompt("hello!");
    expect(a).not.toEqual(b);
  });

  it("ref returns stable pointer", async () => {
    const r = new PromptRegistry();
    const rec = await r.register("k", "1.0.0", "x");
    expect(r.ref("k")).toEqual({ key: "k", version: "1.0.0", fingerprint: rec.fingerprint });
  });
});
