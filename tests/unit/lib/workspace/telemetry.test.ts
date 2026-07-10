import { describe, it, expect } from "vitest";
import { InMemorySecurityTelemetrySink, SECURITY_TELEMETRY_EVENTS, SecurityTelemetryEmitter } from "@/lib/workspace/security-telemetry";
import { evaluateBudget, DEFAULT_BUDGETS } from "@/lib/workspace/performance-budget";
import { CopilotPanelStore } from "@/lib/workspace/copilot-panel";

describe("Security Telemetry catalog + Copilot transparency + Budget", () => {
  it("exposes all 10 canonical security events", () => {
    expect(SECURITY_TELEMETRY_EVENTS).toHaveLength(10);
    expect(SECURITY_TELEMETRY_EVENTS).toEqual(expect.arrayContaining([
      "widget_loaded", "widget_denied", "plugin_rejected",
      "snapshot_loaded", "snapshot_invalid",
      "share_created", "share_revoked",
      "realtime_denied", "permission_denforced", "command_palette_denied",
    ]));
  });

  it("emits with the correct severity mapping", () => {
    const sink = new InMemorySecurityTelemetrySink();
    const e = new SecurityTelemetryEmitter(sink);
    e.emit({ organizationId: "o", name: "snapshot_invalid" });
    e.emit({ organizationId: "o", name: "widget_loaded" });
    expect(sink.events.find((x) => x.name === "snapshot_invalid")?.severity).toBe("critical");
    expect(sink.events.find((x) => x.name === "widget_loaded")?.severity).toBe("info");
  });

  it("evaluates performance budget breaches", () => {
    const v = evaluateBudget(DEFAULT_BUDGETS.standard, { loadTimeMs: 4000, memoryMb: 10, requests: 20 });
    expect(v.ok).toBe(false);
    expect(v.breaches).toEqual(expect.arrayContaining(["loadTime", "requests"]));
  });

  it("copilot store aggregates totals per org", () => {
    const s = new CopilotPanelStore();
    s.record({
      organizationId: "o", requestId: "r1", expert: "marketing", model: "gpt-5.5",
      provider: "openai", contextsLoaded: ["billing"], memoriesUsed: [], confidence: 0.9,
      latencyMs: 200, tokensPrompt: 500, tokensCompletion: 300, createdAt: new Date().toISOString(),
    });
    const t = s.totals({ organizationId: "o" });
    expect(t.requests).toBe(1);
    expect(t.tokensPrompt).toBe(500);
    expect(t.avgConfidence).toBeCloseTo(0.9);
  });
});
