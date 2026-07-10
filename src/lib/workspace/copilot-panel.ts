// EPIC K — Copilot Panel Transparency
// Stores per-request transparency frames (expert/model/provider/context/memory/tokens).
import type { CopilotTransparencyFrame, OrgScoped } from "./types";

export class CopilotPanelStore {
  private frames = new Map<string, CopilotTransparencyFrame>();

  record(frame: CopilotTransparencyFrame): void {
    this.frames.set(frame.requestId, frame);
  }

  get(requestId: string): CopilotTransparencyFrame | null {
    return this.frames.get(requestId) ?? null;
  }

  list(o: OrgScoped, limit = 50): CopilotTransparencyFrame[] {
    return [...this.frames.values()]
      .filter((f) => f.organizationId === o.organizationId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, limit);
  }

  totals(o: OrgScoped): { requests: number; tokensPrompt: number; tokensCompletion: number; avgLatencyMs: number; avgConfidence: number } {
    const items = this.list(o, Number.MAX_SAFE_INTEGER);
    const n = items.length;
    if (n === 0) return { requests: 0, tokensPrompt: 0, tokensCompletion: 0, avgLatencyMs: 0, avgConfidence: 0 };
    const sum = items.reduce((a, f) => {
      a.tp += f.tokensPrompt; a.tc += f.tokensCompletion;
      a.lat += f.latencyMs; a.conf += f.confidence;
      return a;
    }, { tp: 0, tc: 0, lat: 0, conf: 0 });
    return {
      requests: n,
      tokensPrompt: sum.tp,
      tokensCompletion: sum.tc,
      avgLatencyMs: Math.round(sum.lat / n),
      avgConfidence: sum.conf / n,
    };
  }
}
