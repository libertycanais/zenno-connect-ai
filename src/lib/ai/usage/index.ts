// FEATURE P0.6 — Onda 3 · Usage Collector
// Records per-execution telemetry. Persistence is injected. In-memory buffer
// is used as fallback (dev/tests) and for benchmark aggregation.

import { providerBenchmark } from "../benchmark";

export type UsageRecord = {
  organizationId: string;
  userId: string;
  conversationId: string | null;
  taskId: string | null;
  provider: string;
  model: string;
  tokensIn: number;
  tokensOut: number;
  latencyMs: number;
  streaming: boolean;
  costCents: number;
  status: "succeeded" | "failed" | "timeout" | "cancelled";
  errorCode?: string;
  timestampMs: number;
};

export interface UsageSink {
  persist(rec: UsageRecord): Promise<void>;
}

export class UsageCollector {
  private buffer: UsageRecord[] = [];
  constructor(private sink?: UsageSink, private readonly bufferCap = 200) {}

  async record(rec: UsageRecord): Promise<void> {
    // Feed benchmark aggregation
    providerBenchmark.record({
      providerId: rec.provider,
      modelId: rec.model,
      latencyMs: rec.latencyMs,
      tokensIn: rec.tokensIn,
      tokensOut: rec.tokensOut,
      costCents: rec.costCents,
      error: rec.status === "failed",
      timeout: rec.status === "timeout",
      timestampMs: rec.timestampMs,
    });
    // Buffer (bounded ring)
    this.buffer.push(rec);
    if (this.buffer.length > this.bufferCap) this.buffer.splice(0, this.buffer.length - this.bufferCap);
    if (this.sink) await this.sink.persist(rec);
  }

  drain(): UsageRecord[] {
    const out = this.buffer.slice();
    this.buffer.length = 0;
    return out;
  }

  peek(): readonly UsageRecord[] { return this.buffer; }
}

export const usageCollector = new UsageCollector();
