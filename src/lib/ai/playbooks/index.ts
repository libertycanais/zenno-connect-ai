// Playbook Engine — Toda recomendação vira plano executável (typed).

import type { EvidenceBundle } from "../evidence";

export type PlaybookUrgency = "low" | "medium" | "high" | "critical";
export type PlaybookComplexity = "low" | "medium" | "high";

export type ChecklistItem = {
  id: string;
  title: string;
  done: boolean;
  ownerRole?: string;
  estimatedMinutes?: number;
};

export type ActionStep = {
  id: string;
  title: string;
  description: string;
  ownerRole: string;
  dependsOn: string[];
  estimatedMinutes: number;
  successCriterion: string;
};

export type FinancialEstimate = {
  costCents: number;         // custo estimado do plano
  savingsCents: number;      // ganho esperado
  paybackDays: number;
};

export type PlaybookInput = {
  playbookId?: string;
  organizationId: string;
  title: string;
  problem: string;
  diagnosis: string;
  evidence: EvidenceBundle;
  impact: string;             // resumo do impacto no negócio
  urgency: PlaybookUrgency;
  complexity: PlaybookComplexity;
  checklist: ChecklistItem[];
  actionPlan: ActionStep[];
  financialEstimate: FinancialEstimate;
  nextSteps: string[];
  successCriteria: string[];
  expectedOutcome: string;
};

export type Playbook = PlaybookInput & {
  playbookId: string;
  version: string;
  createdAt: string;
};

export function buildPlaybook(input: PlaybookInput): Playbook {
  return {
    ...input,
    playbookId: input.playbookId ?? `pb_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    version: "1.0.0",
    createdAt: new Date().toISOString(),
  };
}

export function validatePlaybook(pb: Playbook): { ok: boolean; issues: string[] } {
  const issues: string[] = [];
  if (!pb.evidence || pb.evidence.sources.length === 0) issues.push("evidence.empty");
  if (pb.evidence?.confidence < 0.35) issues.push("evidence.low_confidence");
  if (pb.actionPlan.length === 0) issues.push("actionPlan.empty");
  if (pb.successCriteria.length === 0) issues.push("successCriteria.empty");
  // check DAG
  const ids = new Set(pb.actionPlan.map((s) => s.id));
  for (const s of pb.actionPlan) for (const d of s.dependsOn) if (!ids.has(d)) issues.push(`actionPlan.unknown_dep:${d}`);
  return { ok: issues.length === 0, issues };
}

export class PlaybookStore {
  private m = new Map<string, Playbook>();
  save(pb: Playbook): void { this.m.set(pb.playbookId, pb); }
  get(id: string): Playbook | undefined { return this.m.get(id); }
  listByOrganization(orgId: string): Playbook[] {
    return [...this.m.values()].filter((x) => x.organizationId === orgId);
  }
}

export const playbookStore = new PlaybookStore();
