// FEATURE P0.6 — Onda 3 · Provider Benchmark
// In-memory rolling window per (provider, model). Additive: does not persist
// to DB here — the Usage Collector persists individual events. Benchmark is a
// runtime aggregation used by the Model Selection Engine.

export type BenchmarkSample = {
  providerId: string;
  modelId: string;
  latencyMs: number;
  tokensIn: number;
  tokensOut: number;
  costCents: number;
  error: boolean;
  timeout: boolean;
  timestampMs: number;
  feedbackScore?: number; // -1 | 0 | 1 optional user feedback
};

export type ProviderBenchmarkSnapshot = {
  providerId: string;
  modelId: string;
  samples: number;
  p50LatencyMs: number;
  p95LatencyMs: number;
  avgTokensIn: number;
  avgTokensOut: number;
  avgCostCents: number;
  errorRate01: number;
  timeoutRate01: number;
  availability01: number;
  avgFeedback: number;
};

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.floor((p / 100) * sorted.length)));
  return sorted[idx]!;
}

export class ProviderBenchmarkStore {
  private data = new Map<string, BenchmarkSample[]>();
  constructor(private readonly maxSamplesPerKey = 500) {}

  private key(p: string, m: string) { return `${p}:${m}`; }

  record(sample: BenchmarkSample): void {
    const k = this.key(sample.providerId, sample.modelId);
    const arr = this.data.get(k) ?? [];
    arr.push(sample);
    if (arr.length > this.maxSamplesPerKey) arr.splice(0, arr.length - this.maxSamplesPerKey);
    this.data.set(k, arr);
  }

  snapshot(providerId: string, modelId: string): ProviderBenchmarkSnapshot {
    const samples = this.data.get(this.key(providerId, modelId)) ?? [];
    if (samples.length === 0) {
      return {
        providerId, modelId, samples: 0,
        p50LatencyMs: 0, p95LatencyMs: 0,
        avgTokensIn: 0, avgTokensOut: 0, avgCostCents: 0,
        errorRate01: 0, timeoutRate01: 0, availability01: 1, avgFeedback: 0,
      };
    }
    const lat = samples.map((s) => s.latencyMs).sort((a, b) => a - b);
    const errors = samples.filter((s) => s.error).length;
    const timeouts = samples.filter((s) => s.timeout).length;
    const feedback = samples.filter((s) => typeof s.feedbackScore === "number");
    const sum = <T,>(arr: T[], f: (x: T) => number) => arr.reduce((a, b) => a + f(b), 0);
    return {
      providerId, modelId, samples: samples.length,
      p50LatencyMs: Math.round(percentile(lat, 50)),
      p95LatencyMs: Math.round(percentile(lat, 95)),
      avgTokensIn: Math.round(sum(samples, (s) => s.tokensIn) / samples.length),
      avgTokensOut: Math.round(sum(samples, (s) => s.tokensOut) / samples.length),
      avgCostCents: sum(samples, (s) => s.costCents) / samples.length,
      errorRate01: errors / samples.length,
      timeoutRate01: timeouts / samples.length,
      availability01: 1 - (errors + timeouts) / samples.length,
      avgFeedback: feedback.length ? sum(feedback, (s) => s.feedbackScore ?? 0) / feedback.length : 0,
    };
  }

  snapshotAll(): Map<string, ProviderBenchmarkSnapshot> {
    const out = new Map<string, ProviderBenchmarkSnapshot>();
    for (const k of this.data.keys()) {
      const [p, m] = k.split(":");
      out.set(k, this.snapshot(p!, m!));
    }
    return out;
  }

  reset(): void { this.data.clear(); }
}

export const providerBenchmark = new ProviderBenchmarkStore();
