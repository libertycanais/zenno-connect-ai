// EPIC B — AI Execution Platform · Execution Metrics
// Aggregates per-step + per-provider metrics from the ExecutionEngine. Pure
// in-memory; observability sinks (Prometheus, Sentry) plug in via
// `src/lib/observability`.

import type { StepExecutionResult, ExecutionResult } from "../contracts/executor";

export type ProviderMetrics = {
  provider: string;
  callCount: number;
  totalTokensIn: number;
  totalTokensOut: number;
  totalCostCents: number;
  totalLatencyMs: number;
  errorCount: number;
};

export type ExecutionMetricsSnapshot = {
  runs: number;
  succeeded: number;
  failed: number;
  cancelled: number;
  totalCostCents: number;
  totalLatencyMs: number;
  perProvider: ProviderMetrics[];
};

export class ExecutionMetrics {
  private runs = 0;
  private succeeded = 0;
  private failed = 0;
  private cancelled = 0;
  private totalCostCents = 0;
  private totalLatencyMs = 0;
  private byProvider = new Map<string, ProviderMetrics>();

  recordResult(result: ExecutionResult): void {
    this.runs += 1;
    if (result.status === "completed") this.succeeded += 1;
    else if (result.status === "failed") this.failed += 1;
    else if (result.status === "cancelled") this.cancelled += 1;
    this.totalCostCents += result.totalCostCents;
    this.totalLatencyMs += result.totalLatencyMs;
    for (const s of result.stepResults) this.recordStep(s);
  }

  recordStep(s: StepExecutionResult): void {
    if (!s.provider) return;
    const cur = this.byProvider.get(s.provider) ?? this.emptyProvider(s.provider);
    cur.callCount += 1;
    cur.totalTokensIn += s.tokensIn;
    cur.totalTokensOut += s.tokensOut;
    cur.totalCostCents += s.costCents;
    cur.totalLatencyMs += s.latencyMs;
    if (s.status === "failed") cur.errorCount += 1;
    this.byProvider.set(s.provider, cur);
  }

  snapshot(): ExecutionMetricsSnapshot {
    return {
      runs: this.runs,
      succeeded: this.succeeded,
      failed: this.failed,
      cancelled: this.cancelled,
      totalCostCents: this.totalCostCents,
      totalLatencyMs: this.totalLatencyMs,
      perProvider: [...this.byProvider.values()],
    };
  }

  reset(): void {
    this.runs = 0; this.succeeded = 0; this.failed = 0; this.cancelled = 0;
    this.totalCostCents = 0; this.totalLatencyMs = 0; this.byProvider.clear();
  }

  private emptyProvider(provider: string): ProviderMetrics {
    return {
      provider, callCount: 0, totalTokensIn: 0, totalTokensOut: 0,
      totalCostCents: 0, totalLatencyMs: 0, errorCount: 0,
    };
  }
}

export const executionMetrics = new ExecutionMetrics();
