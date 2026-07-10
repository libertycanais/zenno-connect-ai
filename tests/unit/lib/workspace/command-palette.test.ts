import { describe, it, expect } from "vitest";
import { CommandPalette } from "@/lib/workspace/command-palette";
import { InMemorySecurityTelemetrySink, SecurityTelemetryEmitter } from "@/lib/workspace/security-telemetry";

function setup() {
  const sink = new InMemorySecurityTelemetrySink();
  const t = new SecurityTelemetryEmitter(sink);
  const p = new CommandPalette(t);
  p.register({
    id: "workspace.share", title: "Share workspace", scope: "workspace",
    requiredPermissions: ["workspace.share"], featureFlag: "ws.v2",
    run: async () => ({ ok: true, message: "shared" }),
  });
  return { sink, p };
}

describe("Command Palette permission + feature flag enforcement", () => {
  it("runs when permissions and flags satisfied", async () => {
    const { p } = setup();
    const r = await p.run("workspace.share", {
      organizationId: "o", userId: "u",
      userPermissions: ["workspace.share"], featureFlags: ["ws.v2"],
    });
    expect(r.ok).toBe(true);
  });

  it("denies missing permission and emits telemetry", async () => {
    const { p, sink } = setup();
    const r = await p.run("workspace.share", {
      organizationId: "o", userId: "u",
      userPermissions: [], featureFlags: ["ws.v2"],
    });
    expect(r.ok).toBe(false);
    expect(sink.count("command_palette_denied")).toBe(1);
  });

  it("denies disabled feature flag", async () => {
    const { p, sink } = setup();
    const r = await p.run("workspace.share", {
      organizationId: "o", userId: "u",
      userPermissions: ["workspace.share"], featureFlags: [],
    });
    expect(r.ok).toBe(false);
    expect(sink.count("command_palette_denied")).toBe(1);
  });

  it("denies unknown commands", async () => {
    const { p, sink } = setup();
    const r = await p.run("ghost", {
      organizationId: "o", userId: "u", userPermissions: [], featureFlags: [],
    });
    expect(r.ok).toBe(false);
    expect(sink.count("command_palette_denied")).toBe(1);
  });
});
