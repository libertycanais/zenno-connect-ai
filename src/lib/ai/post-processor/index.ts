// FEATURE P0.6 — Onda 1 · Post-Processor
// Converts free-form provider text into a typed, UI-safe structure.
// The UI never depends on raw model text — always on this schema.

import { z } from "zod";

export const recommendationSchema = z.object({
  title: z.string().min(1).max(200),
  detail: z.string().min(1).max(2000),
  effort: z.enum(["low", "medium", "high"]).default("medium"),
  impact: z.enum(["low", "medium", "high"]).default("medium"),
});

export const structuredResponseSchema = z.object({
  summary: z.string().min(1).max(2000),
  priority: z.enum(["low", "medium", "high", "critical"]).default("medium"),
  financialImpactCents: z.number().int().nullable().default(null),
  confidence: z.number().min(0).max(1).default(0.5),
  recommendations: z.array(recommendationSchema).default([]),
});

export type StructuredResponse = z.infer<typeof structuredResponseSchema>;

/**
 * Best-effort extraction: if the provider returned JSON in a fenced block,
 * parse and validate. Otherwise wrap the raw text as a summary with low confidence.
 * Always returns a valid StructuredResponse — never throws.
 */
export function postProcess(rawText: string): StructuredResponse {
  const jsonBlock = extractJsonBlock(rawText);
  if (jsonBlock) {
    try {
      const parsed = structuredResponseSchema.safeParse(JSON.parse(jsonBlock));
      if (parsed.success) return parsed.data;
    } catch {
      // fall through to text fallback
    }
  }
  const summary = rawText.trim().slice(0, 2000) || "Sem resposta disponível.";
  return structuredResponseSchema.parse({
    summary,
    priority: "medium",
    financialImpactCents: null,
    confidence: 0.3,
    recommendations: [],
  });
}

function extractJsonBlock(text: string): string | null {
  const fenced = /```(?:json)?\s*(\{[\s\S]*?\})\s*```/m.exec(text);
  if (fenced?.[1]) return fenced[1];
  const trimmed = text.trim();
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) return trimmed;
  return null;
}
