import { describe, it, expect } from "vitest";
import { PluginSandbox } from "@/lib/workspace/plugin-sandbox";
import type { PluginManifest } from "@/lib/workspace/types";

const plugin: PluginManifest = {
  id: "p.marketing", version: "1.0.0", name: "Marketing Insights", vendor: "Zenno",
  capabilities: ["reports", "timeline"], sandboxed: true,
};

describe("Plugin Isolation Matrix", () => {
  it("authorizes only declared capabilities", () => {
    const s = new PluginSandbox();
    s.register(plugin);
    expect(s.authorize("p.marketing", "reports").ok).toBe(true);
    expect(s.authorize("p.marketing", "timeline").ok).toBe(true);
    expect(s.authorize("p.marketing", "memory").ok).toBe(false);
    expect(s.authorize("p.marketing", "copilot").ok).toBe(false);
  });

  it("refuses non-sandboxed plugins", () => {
    const s = new PluginSandbox();
    expect(() => s.register({ ...plugin, sandboxed: false as unknown as true })).toThrow(/plugin_must_be_sandboxed/);
  });

  it("blocks revoked plugins from any capability", () => {
    const s = new PluginSandbox();
    s.register(plugin);
    s.revoke("p.marketing");
    const r = s.authorize("p.marketing", "reports");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("revoked");
  });

  it("returns unknown_plugin for unregistered ids", () => {
    const s = new PluginSandbox();
    const r = s.authorize("p.ghost", "reports");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("unknown_plugin");
  });
});
