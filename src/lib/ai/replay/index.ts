// EPIC H — Decision Replay (org-scoped, immutable snapshots)
import type { MemoryRecord } from "../memory-engine";
import type { BusinessDNA } from "../business-dna";

export type DecisionReplaySnapshot = {
  replayId: string;
  organizationId: string;
  decisionId: string;
  capturedAt: string;
  context: Record<string, unknown>;
  businessDNA: BusinessDNA | null;
  memories: MemoryRecord[];
  promptVersion: string;
  ruleVersions: Record<string, string>;
  expertVersion: string;
  provider: string;
  model: string;
  workflow: Record<string, unknown>;
  timeline: Array<{ at: string; label: string; payload?: Record<string, unknown> }>;
  result: Record<string, unknown>;
};

const gid = () => `rpl_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

export class DecisionReplayStore {
  private snaps: DecisionReplaySnapshot[] = [];

  capture(input: Omit<DecisionReplaySnapshot, "replayId" | "capturedAt">): DecisionReplaySnapshot {
    if (input.businessDNA && input.businessDNA.organizationId !== input.organizationId) {
      throw new Error("cross-tenant DNA capture forbidden");
    }
    if (input.memories.some((m) => m.organizationId !== input.organizationId)) {
      throw new Error("cross-tenant memory capture forbidden");
    }
    const snap: DecisionReplaySnapshot = { ...input, replayId: gid(), capturedAt: new Date().toISOString() };
    this.snaps.push(snap);
    return snap;
  }

  get(replayId: string, organizationId: string): DecisionReplaySnapshot | null {
    const s = this.snaps.find((x) => x.replayId === replayId);
    if (!s || s.organizationId !== organizationId) return null;
    return s;
  }

  listByDecision(organizationId: string, decisionId: string): DecisionReplaySnapshot[] {
    return this.snaps.filter((s) => s.organizationId === organizationId && s.decisionId === decisionId);
  }
}

export const decisionReplayStore = new DecisionReplayStore();
