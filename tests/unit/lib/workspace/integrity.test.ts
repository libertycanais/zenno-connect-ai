import { describe, it, expect } from "vitest";
import { computeIntegrity, verifyIntegrity } from "@/lib/workspace/integrity";
import type { WorkspaceSnapshot } from "@/lib/workspace/types";

function makeSnapshot(overrides: Partial<WorkspaceSnapshot> = {}): WorkspaceSnapshot {
  const base = {
    id: "snap_1", workspaceId: "ws_1", organizationId: "org_a",
    version: 1, schemaVersion: 1, createdBy: "user_1", createdAt: "2026-07-10T00:00:00Z",
    widgets: [
      { instanceId: "i1", manifestId: "w.kpis", manifestVersion: "1.0.0", size: "md" as const, position: 0 },
      { instanceId: "i2", manifestId: "w.timeline", manifestVersion: "1.0.0", size: "lg" as const, position: 1 },
    ],
    layout: { columns: 12 },
  };
  const integrity = computeIntegrity(base);
  return { ...base, integrity, ...overrides };
}

describe("Snapshot Integrity (SHA-256)", () => {
  it("computes stable hash independent of widget order", () => {
    const s1 = makeSnapshot();
    const s2 = makeSnapshot({
      widgets: [...s1.widgets].reverse(),
    });
    // recompute after reorder
    const h2 = computeIntegrity({ ...s2 });
    expect(h2.sha256).toBe(s1.integrity.sha256);
  });

  it("verifies a valid snapshot", () => {
    const s = makeSnapshot();
    expect(verifyIntegrity(s).ok).toBe(true);
  });

  it("fails when any content field is tampered", () => {
    const s = makeSnapshot();
    const tampered: WorkspaceSnapshot = { ...s, widgets: [...s.widgets, { instanceId: "i3", manifestId: "x", manifestVersion: "1", size: "sm", position: 2 }] };
    const v = verifyIntegrity(tampered);
    expect(v.ok).toBe(false);
    expect(v.reason).toBe("hash_mismatch");
  });

  it("fails on cross-org replay", () => {
    const s = makeSnapshot();
    const forged: WorkspaceSnapshot = { ...s, organizationId: "org_b" };
    expect(verifyIntegrity(forged).ok).toBe(false);
  });
});
