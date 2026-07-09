// FEATURE P0.6 — Onda 3 · Provider Health Monitor
// Tracks provider health from live samples. Read by Selection Engine.

export type ProviderHealthStatus = "online" | "offline" | "degraded";

export type HealthSample = {
  providerId: string;
  ok: boolean;
  latencyMs: number;
  errorCode?: string;
  timestampMs: number;
};

export type HealthSnapshot = {
  providerId: string;
  status: ProviderHealthStatus;
  avgLatencyMs: number;
  uptime01: number;
  lastError: string | null;
  lastCheckMs: number;
  samples: number;
};

const WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const MIN_SAMPLES = 3;

export class ProviderHealthMonitor {
  private samples = new Map<string, HealthSample[]>();

  record(s: HealthSample): void {
    const arr = this.samples.get(s.providerId) ?? [];
    arr.push(s);
    const cutoff = Date.now() - WINDOW_MS;
    while (arr.length && arr[0]!.timestampMs < cutoff) arr.shift();
    this.samples.set(s.providerId, arr);
  }

  snapshot(providerId: string): HealthSnapshot {
    const arr = this.samples.get(providerId) ?? [];
    if (arr.length === 0) {
      return {
        providerId, status: "online",
        avgLatencyMs: 0, uptime01: 1, lastError: null,
        lastCheckMs: 0, samples: 0,
      };
    }
    const ok = arr.filter((s) => s.ok).length;
    const uptime01 = ok / arr.length;
    const avgLatencyMs = arr.reduce((a, b) => a + b.latencyMs, 0) / arr.length;
    const lastErr = [...arr].reverse().find((s) => !s.ok);
    let status: ProviderHealthStatus = "online";
    if (arr.length >= MIN_SAMPLES) {
      if (uptime01 === 0) status = "offline";
      else if (uptime01 < 0.8 || avgLatencyMs > 15_000) status = "degraded";
    }
    return {
      providerId,
      status,
      avgLatencyMs: Math.round(avgLatencyMs),
      uptime01,
      lastError: lastErr?.errorCode ?? null,
      lastCheckMs: arr[arr.length - 1]!.timestampMs,
      samples: arr.length,
    };
  }

  snapshotAll(): Map<string, HealthSnapshot> {
    const out = new Map<string, HealthSnapshot>();
    for (const id of this.samples.keys()) out.set(id, this.snapshot(id));
    return out;
  }

  reset(): void { this.samples.clear(); }
}

export const providerHealth = new ProviderHealthMonitor();
