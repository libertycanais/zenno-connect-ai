// Evidence Engine — rastreia origem de cada conclusão do Expert.
// Nunca permite alucinação silenciosa: Recommendation sem evidência é rejeitada.

import type { KpiResult } from "@/lib/business/types";

export type EvidenceSource =
  | { kind: "kpi"; kpi: string; value: number | null; unit: string; formula: string }
  | { kind: "knowledge_rule"; ruleId: string; domain: string; version: string }
  | { kind: "benchmark"; key: string; percentile: number }
  | { kind: "context_snapshot"; snapshotId: string; module: string }
  | { kind: "raw_data"; description: string; sampleSize: number };

export type MissingEvidence = { code: string; description: string };

export type EvidenceBundle = {
  evidenceId: string;                // stable id
  organizationId: string;
  sources: EvidenceSource[];
  missing: MissingEvidence[];
  confidence: number;                // 0..1
  createdAt: string;
};

export type EvidenceBuilderInput = {
  organizationId: string;
  kpis?: KpiResult[];
  ruleIds?: Array<{ id: string; domain: string; version: string }>;
  benchmarks?: Array<{ key: string; percentile: number }>;
  snapshots?: Array<{ snapshotId: string; module: string }>;
  raw?: Array<{ description: string; sampleSize: number }>;
  missing?: MissingEvidence[];
};

export function buildEvidence(input: EvidenceBuilderInput): EvidenceBundle {
  const sources: EvidenceSource[] = [];
  for (const k of input.kpis ?? []) {
    sources.push({ kind: "kpi", kpi: k.kpi, value: k.value, unit: k.unit, formula: k.formula });
  }
  for (const r of input.ruleIds ?? []) sources.push({ kind: "knowledge_rule", ruleId: r.id, domain: r.domain, version: r.version });
  for (const b of input.benchmarks ?? []) sources.push({ kind: "benchmark", ...b });
  for (const s of input.snapshots ?? []) sources.push({ kind: "context_snapshot", ...s });
  for (const d of input.raw ?? []) sources.push({ kind: "raw_data", ...d });

  const missing = input.missing ?? [];
  const confidence = computeConfidence(sources, missing);
  return {
    evidenceId: `ev_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    organizationId: input.organizationId,
    sources, missing, confidence,
    createdAt: new Date().toISOString(),
  };
}

export function computeConfidence(sources: EvidenceSource[], missing: MissingEvidence[]): number {
  if (sources.length === 0) return 0;
  const distinctKinds = new Set(sources.map((s) => s.kind)).size;
  const base = Math.min(1, sources.length / 6);
  const diversityBonus = Math.min(0.3, (distinctKinds - 1) * 0.1);
  const penalty = Math.min(0.6, missing.length * 0.15);
  return Math.max(0, Math.min(1, base + diversityBonus - penalty));
}

export class EvidenceStore {
  private m = new Map<string, EvidenceBundle>();
  save(b: EvidenceBundle): void { this.m.set(b.evidenceId, b); }
  get(id: string): EvidenceBundle | undefined { return this.m.get(id); }
  listByOrganization(orgId: string): EvidenceBundle[] {
    return [...this.m.values()].filter((x) => x.organizationId === orgId);
  }
}

export const evidenceStore = new EvidenceStore();
