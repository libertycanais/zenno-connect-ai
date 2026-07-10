// RC1.5 — Server Function latency metrics (p50/p95) — additive, in-memory rolling window.
// Consumed by Prometheus exporter (src/lib/observability/prometheus.ts) when present.
// 100% additive. Does not modify any existing server-fn contract.

type Sample = { at: number; ms: number };

const WINDOW_MS = 5 * 60_000;
const MAX_SAMPLES = 500;
const buckets = new Map<string, Sample[]>();

export function recordServerFnLatency(name: string, ms: number): void {
  if (!Number.isFinite(ms) || ms < 0) return;
  const now = Date.now();
  const arr = buckets.get(name) ?? [];
  arr.push({ at: now, ms });
  // GC: drop old + cap length
  const kept = arr.filter((s) => now - s.at <= WINDOW_MS);
  if (kept.length > MAX_SAMPLES) kept.splice(0, kept.length - MAX_SAMPLES);
  buckets.set(name, kept);
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[idx] ?? 0;
}

export type ServerFnStats = {
  name: string;
  count: number;
  p50: number;
  p95: number;
  p99: number;
  maxMs: number;
};

export function getServerFnStats(name: string): ServerFnStats {
  const now = Date.now();
  const samples = (buckets.get(name) ?? []).filter((s) => now - s.at <= WINDOW_MS);
  const sorted = samples.map((s) => s.ms).sort((a, b) => a - b);
  return {
    name,
    count: sorted.length,
    p50: percentile(sorted, 50),
    p95: percentile(sorted, 95),
    p99: percentile(sorted, 99),
    maxMs: sorted[sorted.length - 1] ?? 0,
  };
}

export function listServerFnStats(): ServerFnStats[] {
  return Array.from(buckets.keys()).map(getServerFnStats);
}

/** Wrap any async fn with instrumentation. Additive helper — opt-in per call site. */
export async function measureServerFn<T>(name: string, fn: () => Promise<T>): Promise<T> {
  const start = Date.now();
  try {
    return await fn();
  } finally {
    recordServerFnLatency(name, Date.now() - start);
  }
}

export function __resetServerFnMetricsForTests(): void {
  buckets.clear();
}
