// P0.6 · Onda 3 — Tool Registry contract
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { ToolRegistry, toolRegistry } from "@/lib/ai/tools";

describe("Tool Registry", () => {
  it("has the system.ping seed tool", () => {
    expect(toolRegistry.get("system.ping")?.scope).toBe("read");
  });

  it("validateArgs succeeds for correct payload", () => {
    const r = toolRegistry.validateArgs("system.ping", { echo: "hi" });
    expect(r.ok).toBe(true);
  });

  it("validateArgs fails for unknown tool", () => {
    const r = toolRegistry.validateArgs("nope", {});
    expect(r.ok).toBe(false);
  });

  it("validateArgs fails for schema mismatch", () => {
    const reg = new ToolRegistry();
    reg.register({
      name: "t", description: "d", scope: "write", needsApproval: true,
      inputSchema: z.object({ n: z.number() }),
    });
    expect(reg.validateArgs("t", { n: "x" }).ok).toBe(false);
    expect(reg.validateArgs("t", { n: 4 }).ok).toBe(true);
  });
});
