// FEATURE — Marketing Intelligence · Observability sink (in-memory)
import type { IntelligenceMetrics } from "../types";

const runs: Array<{ organizationId: string; at: string; metrics: IntelligenceMetrics }> = [];

export function recordRun(organizationId: string, metrics: IntelligenceMetrics): void {
  runs.push({ organizationId, at: new Date().toISOString(), metrics });
  if (runs.length > 200) runs.splice(0, runs.length - 200);
}

export function getRuns(organizationId: string) {
  return runs.filter((r) => r.organizationId === organizationId);
}

export function clearRuns(): void { runs.length = 0; }
