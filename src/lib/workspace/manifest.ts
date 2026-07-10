// EPIC K — Widget Manifest registry + Zero-Trust authorization
import type { WidgetCapability, WidgetManifest } from "./types";

const KNOWN_CAPABILITIES: WidgetCapability[] = [
  "search", "realtime", "notifications", "reports",
  "timeline", "copilot", "memory", "forecast",
];

export type ManifestAuthAction = {
  capability?: WidgetCapability;
  signal?: string;
  api?: string;
  permission?: string;
  featureFlag?: string;
};

export class WidgetManifestRegistry {
  private readonly manifests = new Map<string, WidgetManifest>();

  register(m: WidgetManifest): void {
    this.assertValid(m);
    this.manifests.set(this.key(m.id, m.version), m);
  }

  unregister(id: string, version: string): void {
    this.manifests.delete(this.key(id, version));
  }

  get(id: string, version: string): WidgetManifest | null {
    return this.manifests.get(this.key(id, version)) ?? null;
  }

  list(): WidgetManifest[] { return [...this.manifests.values()]; }

  validate(m: WidgetManifest): { ok: true } | { ok: false; error: string } {
    try { this.assertValid(m); return { ok: true }; }
    catch (e) { return { ok: false, error: (e as Error).message }; }
  }

  authorize(id: string, version: string, action: ManifestAuthAction): boolean {
    const m = this.get(id, version);
    if (!m) return false;
    if (action.capability && !m.requiredCapabilities.includes(action.capability)) return false;
    if (action.signal && !m.allowedSignals.includes(action.signal)) return false;
    if (action.api && !m.allowedApis.includes(action.api)) return false;
    if (action.permission && !m.permissions.includes(action.permission)) return false;
    if (action.featureFlag && !m.featureFlags.includes(action.featureFlag)) return false;
    return true;
  }

  private assertValid(m: WidgetManifest): void {
    if (!m.id) throw new Error("manifest_missing_id");
    if (!m.version) throw new Error("manifest_missing_version");
    if (!m.type) throw new Error("manifest_missing_type");
    for (const c of m.requiredCapabilities) {
      if (!KNOWN_CAPABILITIES.includes(c)) throw new Error(`unknown_capability:${c}`);
    }
    if (m.permissions.some((p) => !p)) throw new Error("empty_permission");
    if (!m.performance) throw new Error("manifest_missing_performance");
    const b = m.performance;
    if (b.maxLoadTimeMs <= 0 || b.maxMemoryMb <= 0 || b.maxRequests <= 0) {
      throw new Error("invalid_performance_budget");
    }
    if (b.priority < 1 || b.priority > 5) throw new Error("invalid_priority");
  }

  private key(id: string, version: string): string { return `${id}@${version}`; }
}

export const KNOWN_WIDGET_CAPABILITIES = KNOWN_CAPABILITIES;
