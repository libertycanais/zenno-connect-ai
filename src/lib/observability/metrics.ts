// Sprint 5.3 — Observability: in-memory metrics registry (Workers-compatible).
// Additive layer. No external dependencies. Safe for Cloudflare Workers isolates.
//
// Cada isolate mantém seu próprio snapshot. O endpoint /api/public/metrics
// expõe o snapshot atual do isolate que atende a requisição — suficiente para
// scraping periódico e agregação externa (Prometheus/Datadog) na Sprint 5.4+.
//
// NÃO usar para métricas de negócio persistentes (usar Postgres/audit_log).

export type MetricLabels = Record<string, string | number | boolean>;

type CounterEntry = { name: string; labels: MetricLabels; value: number };
type HistogramEntry = {
  name: string;
  labels: MetricLabels;
  count: number;
  sum: number;
  min: number;
  max: number;
  // p95 approximation via bounded reservoir (last 512 samples).
  samples: number[];
};

const RESERVOIR_MAX = 512;

const counters = new Map<string, CounterEntry>();
const histograms = new Map<string, HistogramEntry>();

function key(name: string, labels: MetricLabels): string {
  const parts = Object.keys(labels)
    .sort()
    .map((k) => `${k}=${String(labels[k])}`);
  return `${name}|${parts.join(",")}`;
}

/** Incrementa contador monotônico. */
export function incCounter(
  name: string,
  labels: MetricLabels = {},
  by = 1,
): void {
  const k = key(name, labels);
  const cur = counters.get(k);
  if (cur) cur.value += by;
  else counters.set(k, { name, labels, value: by });
}

/** Observa uma amostra em ms/bytes/etc. */
export function observe(
  name: string,
  value: number,
  labels: MetricLabels = {},
): void {
  const k = key(name, labels);
  let h = histograms.get(k);
  if (!h) {
    h = {
      name,
      labels,
      count: 0,
      sum: 0,
      min: value,
      max: value,
      samples: [],
    };
    histograms.set(k, h);
  }
  h.count += 1;
  h.sum += value;
  if (value < h.min) h.min = value;
  if (value > h.max) h.max = value;
  if (h.samples.length >= RESERVOIR_MAX) {
    // Reservoir replacement (Vitter's Algorithm R simplified).
    const idx = Math.floor(Math.random() * h.count);
    if (idx < RESERVOIR_MAX) h.samples[idx] = value;
  } else {
    h.samples.push(value);
  }
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(
    sorted.length - 1,
    Math.max(0, Math.floor((p / 100) * sorted.length)),
  );
  return sorted[idx] ?? 0;
}

export type MetricsSnapshot = {
  timestamp: string;
  counters: Array<{ name: string; labels: MetricLabels; value: number }>;
  histograms: Array<{
    name: string;
    labels: MetricLabels;
    count: number;
    sum: number;
    avg: number;
    min: number;
    max: number;
    p50: number;
    p95: number;
    p99: number;
  }>;
};

export function snapshot(): MetricsSnapshot {
  const hs = Array.from(histograms.values()).map((h) => {
    const sorted = [...h.samples].sort((a, b) => a - b);
    return {
      name: h.name,
      labels: h.labels,
      count: h.count,
      sum: h.sum,
      avg: h.count > 0 ? h.sum / h.count : 0,
      min: h.min,
      max: h.max,
      p50: percentile(sorted, 50),
      p95: percentile(sorted, 95),
      p99: percentile(sorted, 99),
    };
  });
  return {
    timestamp: new Date().toISOString(),
    counters: Array.from(counters.values()),
    histograms: hs,
  };
}

/** Testes / reset controlado (não expor via HTTP). */
export function __resetMetrics(): void {
  counters.clear();
  histograms.clear();
}

/** Helper: mede duração de uma função async e registra em histograma. */
export async function timed<T>(
  name: string,
  labels: MetricLabels,
  fn: () => Promise<T>,
): Promise<T> {
  const start =
    typeof performance !== "undefined" ? performance.now() : Date.now();
  try {
    const out = await fn();
    observe(name, Math.max(0, (typeof performance !== "undefined" ? performance.now() : Date.now()) - start), {
      ...labels,
      status: "ok",
    });
    return out;
  } catch (err) {
    observe(name, Math.max(0, (typeof performance !== "undefined" ? performance.now() : Date.now()) - start), {
      ...labels,
      status: "error",
    });
    incCounter(`${name}_errors_total`, labels);
    throw err;
  }
}
