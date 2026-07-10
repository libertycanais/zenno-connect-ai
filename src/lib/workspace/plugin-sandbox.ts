// EPIC K — Plugin Capability Sandbox
// Every plugin declares capabilities; runtime authorizes only what's declared.
import type { PluginCapability, PluginManifest } from "./types";

const KNOWN: PluginCapability[] = [
  "search", "realtime", "notifications", "reports",
  "timeline", "copilot", "memory", "forecast",
];

export type PluginAuthResult =
  | { ok: true }
  | { ok: false; reason: "unknown_plugin" | "capability_denied" | "revoked" };

export class PluginSandbox {
  private plugins = new Map<string, PluginManifest>();
  private revoked = new Set<string>();

  register(m: PluginManifest): void {
    if (!m.id) throw new Error("plugin_missing_id");
    if (!m.version) throw new Error("plugin_missing_version");
    if (m.sandboxed !== true) throw new Error("plugin_must_be_sandboxed");
    for (const c of m.capabilities) {
      if (!KNOWN.includes(c)) throw new Error(`unknown_capability:${c}`);
    }
    this.plugins.set(m.id, m);
  }

  authorize(pluginId: string, capability: PluginCapability): PluginAuthResult {
    if (this.revoked.has(pluginId)) return { ok: false, reason: "revoked" };
    const p = this.plugins.get(pluginId);
    if (!p) return { ok: false, reason: "unknown_plugin" };
    if (!p.capabilities.includes(capability)) return { ok: false, reason: "capability_denied" };
    return { ok: true };
  }

  revoke(pluginId: string): void { this.revoked.add(pluginId); }
  isRevoked(pluginId: string): boolean { return this.revoked.has(pluginId); }
  list(): PluginManifest[] { return [...this.plugins.values()]; }
  get(id: string): PluginManifest | null { return this.plugins.get(id) ?? null; }
}

export const KNOWN_PLUGIN_CAPABILITIES = KNOWN;
