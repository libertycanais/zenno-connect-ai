import { describe, it, expect } from "vitest";
import { WidgetManifestRegistry } from "@/lib/workspace/manifest";
import type { WidgetManifest } from "@/lib/workspace/types";

const base: WidgetManifest = {
  id: "w.kpis", version: "1.0.0", type: "kpis",
  permissions: ["dashboard.read"], requiredCapabilities: ["reports"],
  allowedSignals: ["kpi.updated"], allowedApis: ["/api/kpis"],
  featureFlags: ["ws.v2"],
  performance: { maxLoadTimeMs: 1500, maxMemoryMb: 48, maxRequests: 6, cacheTtlSeconds: 60, priority: 3 },
};

describe("Widget Manifest Validation", () => {
  it("registers a valid manifest and authorizes declared actions", () => {
    const r = new WidgetManifestRegistry();
    r.register(base);
    expect(r.authorize("w.kpis", "1.0.0", { capability: "reports" })).toBe(true);
    expect(r.authorize("w.kpis", "1.0.0", { signal: "kpi.updated" })).toBe(true);
    expect(r.authorize("w.kpis", "1.0.0", { api: "/api/kpis" })).toBe(true);
    expect(r.authorize("w.kpis", "1.0.0", { permission: "dashboard.read" })).toBe(true);
  });

  it("denies undeclared actions (Zero Trust)", () => {
    const r = new WidgetManifestRegistry();
    r.register(base);
    expect(r.authorize("w.kpis", "1.0.0", { capability: "memory" })).toBe(false);
    expect(r.authorize("w.kpis", "1.0.0", { signal: "other" })).toBe(false);
    expect(r.authorize("w.kpis", "1.0.0", { api: "/api/other" })).toBe(false);
    expect(r.authorize("w.kpis", "1.0.0", { permission: "admin" })).toBe(false);
    expect(r.authorize("w.unknown", "1.0.0", { capability: "reports" })).toBe(false);
  });

  it("rejects manifests with unknown capabilities or invalid budgets", () => {
    const r = new WidgetManifestRegistry();
    // @ts-expect-error - deliberate invalid cap
    expect(() => r.register({ ...base, requiredCapabilities: ["telepathy"] })).toThrow(/unknown_capability/);
    expect(() => r.register({ ...base, performance: { ...base.performance, priority: 9 as 1 } })).toThrow(/invalid_priority/);
    expect(() => r.register({ ...base, performance: { ...base.performance, maxLoadTimeMs: 0 } })).toThrow(/invalid_performance_budget/);
  });
});
