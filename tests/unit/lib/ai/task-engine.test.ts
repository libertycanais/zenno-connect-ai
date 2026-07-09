// P0.6 · Onda 1 — Task Engine helpers
import { describe, expect, it } from "vitest";
import { buildTaskInsert, canTransition, clampPriority, computeDurationMs, isTerminal } from "@/lib/ai/task-engine";

describe("Task Engine", () => {
  it("terminal states cannot transition", () => {
    expect(isTerminal("succeeded")).toBe(true);
    expect(canTransition("succeeded", "running")).toBe(false);
    expect(canTransition("failed", "succeeded")).toBe(false);
  });

  it("queued → running → succeeded is valid", () => {
    expect(canTransition("queued", "running")).toBe(true);
    expect(canTransition("running", "succeeded")).toBe(true);
  });

  it("queued cannot go directly to succeeded", () => {
    expect(canTransition("queued", "succeeded")).toBe(false);
  });

  it("clamps priority into [1,10] and defaults to 5", () => {
    expect(clampPriority(undefined)).toBe(5);
    expect(clampPriority(0)).toBe(1);
    expect(clampPriority(11)).toBe(10);
    expect(clampPriority(3.7)).toBe(4);
    expect(clampPriority(Number.NaN)).toBe(5);
  });

  it("buildTaskInsert produces safe defaults", () => {
    const row = buildTaskInsert({
      organizationId: "org-1",
      userId: "user-1",
      type: "AI",
    });
    expect(row.status).toBe("queued");
    expect(row.priority).toBe(5);
    expect(row.payload).toEqual({});
    expect(row.conversation_id).toBeNull();
  });

  it("computeDurationMs returns null when missing timestamps", () => {
    expect(computeDurationMs(null, null)).toBeNull();
    expect(computeDurationMs("2026-01-01T00:00:00Z", null)).toBeNull();
  });

  it("computeDurationMs computes ms diff", () => {
    expect(computeDurationMs("2026-01-01T00:00:00Z", "2026-01-01T00:00:01Z")).toBe(1000);
  });
});
