import { describe, it, expect } from "vitest";
import { WidgetManifestRegistry } from "@/lib/workspace/manifest";
import { DashboardComposerV2 } from "@/lib/workspace/dashboard-composer";
import { InMemorySecurityTelemetrySink, SecurityTelemetryEmitter } from "@/lib/workspace/security-telemetry";
import { ZeroTrustWidgetRuntime } from "@/lib/workspace/widget-engine";
import type { WidgetManifest, WorkspaceWidgetInstance } from "@/lib/workspace/types";

const kpis: WidgetManifest = {
  id: "w.kpis", version: "1.0.0", type: "kpis",
  permissions: ["dashboard.read"], requiredCapabilities: ["reports"],
  allowedSignals: ["kpi.updated"], allowedApis: ["/api/kpis"], featureFlags: [],
  performance: { maxLoadTimeMs: 1500, maxMemoryMb: 48, maxRequests: 6, cacheTtlSeconds: 60, priority: 3 },
};

function setup() {
  const registry = new WidgetManifestRegistry();
  registry.register(kpis);
  const sink = new InMemorySecurityTelemetrySink();
  const telemetry = new SecurityTelemetryEmitter(sink);
  const composer = new DashboardComposerV2(registry, telemetry);
  const runtime = new ZeroTrustWidgetRuntime(registry, telemetry);
  return { registry, sink, telemetry, composer, runtime };
}

const w: WorkspaceWidgetInstance = {
  instanceId: "i1", manifestId: "w.kpis", manifestVersion: "1.0.0", size: "md", position: 0,
};

describe("Dashboard Composer v2 + Zero-Trust Runtime + Telemetry", () => {
  it("creates a versioned integrity-verified snapshot per organization", () => {
    const { composer } = setup();
    const snap = composer.snapshot({
      organizationId: "org_a", workspaceId: "ws_1", layoutId: "l1", name: "Home",
      widgets: [w], createdBy: "u1", version: 1,
    });
    expect(snap.integrity.sha256).toMatch(/^[a-f0-9]{64}$/);
    const loaded = composer.loadSnapshot({ organizationId: "org_a" }, snap.id);
    expect(loaded.id).toBe(snap.id);
  });

  it("blocks cross-org snapshot load (Permission Matrix)", () => {
    const { composer } = setup();
    const snap = composer.snapshot({
      organizationId: "org_a", workspaceId: "ws_1", layoutId: "l1", name: "Home",
      widgets: [w], createdBy: "u1", version: 1,
    });
    expect(() => composer.loadSnapshot({ organizationId: "org_b" }, snap.id)).toThrow(/org_mismatch/);
  });

  it("rejects layouts referencing unknown manifests", () => {
    const { composer } = setup();
    expect(() => composer.upsertLayout({
      organizationId: "org_a", workspaceId: "ws_1", layoutId: "l1", name: "x",
      widgets: [{ ...w, manifestId: "w.ghost" }], createdBy: "u1", version: 1,
    })).toThrow(/unknown_manifest/);
  });

  it("Zero-Trust runtime denies undeclared actions and emits telemetry", () => {
    const { runtime, sink } = setup();
    const denied = runtime.load(
      { organizationId: "org_a", workspaceId: "ws_1", userId: "u1" }, w,
      [{ capability: "memory" }],
    );
    expect(denied.ok).toBe(false);
    expect(sink.count("widget_denied")).toBe(1);
  });

  it("emits widget_loaded on success", () => {
    const { runtime, sink } = setup();
    const ok = runtime.load(
      { organizationId: "org_a", workspaceId: "ws_1", userId: "u1" }, w,
      [{ capability: "reports" }, { api: "/api/kpis" }],
    );
    expect(ok.ok).toBe(true);
    expect(sink.count("widget_loaded")).toBe(1);
  });
});
