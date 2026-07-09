// FEATURE P0.6 — Onda 3 · Explainability
// Every AI response is wrapped with provenance metadata. Additive to Onda 1
// Post-Processor — does not modify it.

import { z } from "zod";

import type { StructuredResponse } from "../post-processor";

export const sourceRefSchema = z.object({
  module: z.string(),
  label: z.string(),
  freshnessAgeMs: z.number().int().nonnegative().nullable().default(null),
});

export const explainabilitySchema = z.object({
  confidence: z.number().min(0).max(1),
  sources: z.array(sourceRefSchema).default([]),
  freshness: z.enum(["realtime", "fresh", "stale", "unknown"]).default("unknown"),
  reasoningSummary: z.string().max(2_000).nullable().default(null),
  contextUsedModules: z.array(z.string()).default([]),
  contextTokens: z.number().int().nonnegative().default(0),
  provider: z.string(),
  model: z.string(),
  latencyMs: z.number().int().nonnegative(),
  costCents: z.number().int().nonnegative(),
});

export type SourceRef = z.infer<typeof sourceRefSchema>;
export type Explainability = z.infer<typeof explainabilitySchema>;

export type ExplainedResponse = {
  response: StructuredResponse;
  explainability: Explainability;
};

export function classifyFreshness(maxAgeMs: number): Explainability["freshness"] {
  if (maxAgeMs <= 60_000) return "realtime";
  if (maxAgeMs <= 15 * 60_000) return "fresh";
  if (maxAgeMs <= 6 * 60 * 60_000) return "stale";
  return "unknown";
}

export function attachExplainability(
  response: StructuredResponse,
  meta: Omit<Explainability, "freshness"> & { freshness?: Explainability["freshness"] },
): ExplainedResponse {
  const parsed = explainabilitySchema.parse({
    ...meta,
    freshness: meta.freshness ?? "unknown",
  });
  return { response, explainability: parsed };
}
