// FEATURE — First Five Minutes · TTFI (Time To First Intelligence) tracker
// Additive KPI. Measures ms from platform connection to first snapshot ready.
// In-memory; scoped per organization+connection.

export type TTFIRun = {
  organizationId: string;
  connectionId: string;
  startedAt: string;      // ISO
  completedAt: string | null;
  durationMs: number | null;
};

const active = new Map<string, TTFIRun>();        // key: org:conn
const history: TTFIRun[] = [];
const HISTORY_LIMIT = 200;

function key(organizationId: string, connectionId: string): string {
  return `${organizationId}::${connectionId}`;
}

export function startTTFI(organizationId: string, connectionId: string, now = new Date()): TTFIRun {
  const run: TTFIRun = {
    organizationId,
    connectionId,
    startedAt: now.toISOString(),
    completedAt: null,
    durationMs: null,
  };
  active.set(key(organizationId, connectionId), run);
  return run;
}

export function completeTTFI(
  organizationId: string,
  connectionId: string,
  now = new Date(),
): TTFIRun | null {
  const k = key(organizationId, connectionId);
  const run = active.get(k);
  if (!run) return null;
  const completedAt = now.toISOString();
  const durationMs = new Date(completedAt).getTime() - new Date(run.startedAt).getTime();
  const finished: TTFIRun = { ...run, completedAt, durationMs };
  active.delete(k);
  history.push(finished);
  if (history.length > HISTORY_LIMIT) history.splice(0, history.length - HISTORY_LIMIT);
  return finished;
}

export function getActiveTTFI(organizationId: string, connectionId: string): TTFIRun | null {
  return active.get(key(organizationId, connectionId)) ?? null;
}

export function getLastTTFI(organizationId: string): TTFIRun | null {
  for (let i = history.length - 1; i >= 0; i--) {
    if (history[i].organizationId === organizationId) return history[i];
  }
  return null;
}

export function averageTTFIms(organizationId?: string): number | null {
  const scope = organizationId ? history.filter((h) => h.organizationId === organizationId) : history;
  if (scope.length === 0) return null;
  const total = scope.reduce((n, h) => n + (h.durationMs ?? 0), 0);
  return Math.round(total / scope.length);
}

export function clearTTFI(): void {
  active.clear();
  history.length = 0;
}

export function formatTTFI(ms: number | null): string {
  if (ms == null) return "—";
  if (ms < 1000) return `${ms} ms`;
  const s = ms / 1000;
  if (s < 60) return `${s.toFixed(1)}s`;
  const m = Math.floor(s / 60);
  const rem = Math.round(s - m * 60);
  return `${m}m ${rem}s`;
}
