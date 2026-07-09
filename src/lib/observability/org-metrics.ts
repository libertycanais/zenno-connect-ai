// EPIC F — Per-organization observability helpers (additive).
// Wrappers finos sobre o registry canônico (`metrics.ts`), padronizando o
// label `org` para dashboards operacionais.

import { incCounter, observe, timed, type MetricLabels } from "./metrics";

function withOrg(orgId: string, labels: MetricLabels): MetricLabels {
  return { ...labels, org: orgId };
}

export function recordAiRequest(orgId: string, provider: string, model: string): void {
  incCounter("ai.request", withOrg(orgId, { provider, model }));
}

export function recordAiTokens(orgId: string, provider: string, model: string, tokensIn: number, tokensOut: number): void {
  if (tokensIn > 0) incCounter("ai.tokens_in", withOrg(orgId, { provider, model }), tokensIn);
  if (tokensOut > 0) incCounter("ai.tokens_out", withOrg(orgId, { provider, model }), tokensOut);
}

export function recordAiCostCents(orgId: string, provider: string, model: string, cents: number): void {
  if (cents > 0) incCounter("ai.cost_cents", withOrg(orgId, { provider, model }), cents);
}

export function recordAiLatency(orgId: string, provider: string, model: string, latencyMs: number, ok: boolean): void {
  observe("ai.latency_ms", latencyMs, withOrg(orgId, { provider, model, status: ok ? "ok" : "error" }));
  incCounter(ok ? "ai.success" : "ai.error", withOrg(orgId, { provider, model }));
}

export function timedAi<T>(orgId: string, provider: string, model: string, fn: () => Promise<T>): Promise<T> {
  return timed("ai.timed_ms", withOrg(orgId, { provider, model }), fn);
}
