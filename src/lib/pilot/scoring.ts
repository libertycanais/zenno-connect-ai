// RC2 Pilot Program — Health Score & Adoption Score.
// Both scores are 0..100, additive and deterministic; used by pilot dashboard.

import type { PilotEvent } from "./telemetry";

export interface AdoptionInput {
  events: PilotEvent[];
  activeDays: number;         // in last 14d
  featuresUsed: Set<string>;  // distinct feature keys
  totalFeatures: number;      // catalog size
}

export interface HealthInput {
  errorRate: number;      // 0..1
  crashRate: number;      // 0..1
  p95LatencyMs: number;   // Server Function p95
  npsAverage: number | null;   // -100..100
  csatAverage: number | null;  // 0..5
  activeDays: number;     // last 14d
}

/** Adoption Score — coverage of features + engagement frequency. */
export function computeAdoptionScore(input: AdoptionInput): number {
  const coverage = input.totalFeatures > 0 ? input.featuresUsed.size / input.totalFeatures : 0;
  const engagement = Math.min(input.activeDays / 14, 1);
  const volume = Math.min(input.events.length / 200, 1);
  const score = 0.5 * coverage + 0.3 * engagement + 0.2 * volume;
  return Math.round(score * 100 * 100) / 100;
}

/** Health Score — stability + satisfaction + activity. */
export function computeHealthScore(input: HealthInput): number {
  const stability = 1 - Math.min(input.errorRate + input.crashRate * 2, 1);
  const latencyOk = input.p95LatencyMs <= 500 ? 1 : Math.max(0, 1 - (input.p95LatencyMs - 500) / 2000);
  const nps = input.npsAverage == null ? 0.6 : (input.npsAverage + 100) / 200;
  const csat = input.csatAverage == null ? 0.6 : Math.max(0, Math.min(1, input.csatAverage / 5));
  const activity = Math.min(input.activeDays / 14, 1);
  const score = 0.35 * stability + 0.2 * latencyOk + 0.2 * nps + 0.15 * csat + 0.1 * activity;
  return Math.round(score * 100 * 100) / 100;
}

/** NPS from raw responses (0..10). Returns -100..100 or null when no data. */
export function computeNps(scores: number[]): number | null {
  if (scores.length === 0) return null;
  const promoters = scores.filter((s) => s >= 9).length;
  const detractors = scores.filter((s) => s <= 6).length;
  return Math.round(((promoters - detractors) / scores.length) * 100 * 100) / 100;
}

/** CSAT average from raw responses (0..5). */
export function computeCsat(scores: number[]): number | null {
  if (scores.length === 0) return null;
  const sum = scores.reduce((a, b) => a + b, 0);
  return Math.round((sum / scores.length) * 100) / 100;
}

/** Time To First Value (seconds) from onboarding.started → activation.first_value. */
export function computeTtfv(events: PilotEvent[]): number | null {
  const start = events.find((e) => e.eventName === "onboarding.started");
  const first = events.find((e) => e.eventName === "activation.first_value");
  if (!start?.occurredAt || !first?.occurredAt) return null;
  const dt = new Date(first.occurredAt).getTime() - new Date(start.occurredAt).getTime();
  return dt > 0 ? Math.round(dt / 1000) : null;
}
