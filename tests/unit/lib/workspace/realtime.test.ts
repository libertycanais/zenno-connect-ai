import { describe, it, expect } from "vitest";
import { RealtimeAuthorizer } from "@/lib/workspace/realtime";
import { InMemorySecurityTelemetrySink, SecurityTelemetryEmitter } from "@/lib/workspace/security-telemetry";

describe("Realtime Isolation Matrix", () => {
  it("scopes channel to workspace and grants only allowed capabilities", () => {
    const sink = new InMemorySecurityTelemetrySink();
    const auth = new RealtimeAuthorizer(new SecurityTelemetryEmitter(sink));
    const r = auth.authorize({
      organizationId: "org_a", workspaceId: "ws_1", userId: "u1",
      requestedCapabilities: ["reports", "timeline"],
      allowedCapabilities: ["reports", "timeline", "memory"],
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.subscription.channel).toBe("workspace:ws_1");
  });

  it("emits realtime_denied when a requested capability is not allowed", () => {
    const sink = new InMemorySecurityTelemetrySink();
    const auth = new RealtimeAuthorizer(new SecurityTelemetryEmitter(sink));
    const r = auth.authorize({
      organizationId: "org_a", workspaceId: "ws_1", userId: "u1",
      requestedCapabilities: ["memory"],
      allowedCapabilities: ["reports"],
    });
    expect(r.ok).toBe(false);
    expect(sink.count("realtime_denied")).toBe(1);
  });
});
