// Groups signals by domain / severity / dedupeKey for downstream engines.
import type { BusinessSignal, SignalDomain, SignalSeverity } from "./types";

export function groupByDomain(signals: BusinessSignal[]): Record<SignalDomain, BusinessSignal[]> {
  const out = {} as Record<SignalDomain, BusinessSignal[]>;
  for (const s of signals) (out[s.domain] ??= []).push(s);
  return out;
}

export function groupBySeverity(signals: BusinessSignal[]): Record<SignalSeverity, BusinessSignal[]> {
  const out = {} as Record<SignalSeverity, BusinessSignal[]>;
  for (const s of signals) (out[s.severity] ??= []).push(s);
  return out;
}

export function topN(signals: BusinessSignal[], n: number): BusinessSignal[] {
  return [...signals].sort((a, b) => (a.priority - b.priority) || (b.score - a.score)).slice(0, n);
}
