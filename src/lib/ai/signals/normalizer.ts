// Normalizes detector outputs into full BusinessSignal with id/status/dedupe.
import type { BusinessSignal, SignalDetector, SignalDetectorInput } from "./types";
import { scoreToSeverity, computePriority } from "./priority";

function hash(input: string): string {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}

export function makeDedupeKey(orgId: string, type: string, detectorId?: string, ref?: string): string {
  return hash(`${orgId}|${type}|${detectorId ?? ""}|${ref ?? ""}`);
}

export function normalizeSignal(
  detector: SignalDetector,
  input: SignalDetectorInput,
  partial: ReturnType<SignalDetector["detect"]> & object,
): BusinessSignal {
  const createdAt = (input.now ?? new Date()).toISOString();
  const severity = partial.severity ?? scoreToSeverity(partial.score ?? 0);
  const priority = partial.priority ?? computePriority(severity, partial.confidence ?? 0.6);
  const dedupeKey = makeDedupeKey(input.organizationId, partial.type, detector.id, partial.source?.ref);
  return {
    id: `sig_${dedupeKey}_${createdAt.slice(0, 10)}`,
    organizationId: input.organizationId,
    type: partial.type,
    domain: partial.domain,
    severity,
    score: Math.max(0, Math.min(100, Math.round(partial.score ?? 0))),
    priority,
    confidence: Math.max(0, Math.min(1, partial.confidence ?? 0.6)),
    createdAt,
    source: partial.source,
    evidence: partial.evidence ?? [],
    recommendedExperts: partial.recommendedExperts ?? [],
    playbookHint: partial.playbookHint,
    status: "open",
    dedupeKey,
    metadata: partial.metadata,
  };
}
