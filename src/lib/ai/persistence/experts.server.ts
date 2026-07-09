// EPIC D — Supabase-backed repositories for AI Expert outputs.
// SERVER-ONLY. Never import at module scope from a client-reachable file.
// Load inside a server function handler via:
//   const { createSupabaseExpertRepositories } = await import(
//     "@/lib/ai/persistence/experts.server"
//   );
//
// Uses supabaseAdmin (service_role) because the Execution Engine writes on
// behalf of the platform after RLS-scoped authorization has already happened
// upstream in the server function (requireSupabaseAuth + org check).

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type {
  EvidenceRepository, PlaybookRepository, RecommendationRepository,
  PersistedEvidence, PersistedPlaybook, PersistedRecommendation,
  RecommendationStatus, ExpertRepositoryBundle,
} from "../contracts/expert-persistence";
import type { ExpertId } from "../experts/types";

// ---------- Row shapes (untyped JSONB → domain objects) ----------
type EvidenceRow = {
  id: string; organization_id: string; evidence_id: string; expert_id: string;
  sources: unknown; missing: unknown; confidence: number | string;
  created_at: string;
};
type PlaybookRow = {
  id: string; organization_id: string; playbook_id: string; title: string;
  problem: string; diagnosis: string; impact: string;
  urgency: string; complexity: string;
  checklist: unknown; action_plan: unknown; financial_estimate: unknown;
  next_steps: unknown; success_criteria: unknown; expected_outcome: string;
  version: string; evidence_id: string | null; created_at: string;
};
type RecommendationRow = {
  id: string; organization_id: string; recommendation_id: string; expert_id: string;
  summary: string; diagnosis: string; problem: string; impact: string;
  financial_value_cents: number | string; urgency: string; complexity: string;
  checklist: unknown; confidence: number | string; status: string;
  evidence_id: string | null; playbook_id: string | null;
  workflow_id: string | null; task_id: string | null;
  created_at: string;
};

// Helper: resolve a text business id (e.g. "ev_...") into an internal UUID.
async function resolveEvidenceUuid(orgId: string, evidenceId: string | null): Promise<string | null> {
  if (!evidenceId) return null;
  const { data } = await supabaseAdmin
    .from("ai_evidence").select("id")
    .eq("organization_id", orgId).eq("evidence_id", evidenceId).maybeSingle();
  return (data as { id: string } | null)?.id ?? null;
}
async function resolvePlaybookUuid(orgId: string, playbookId: string | null): Promise<string | null> {
  if (!playbookId) return null;
  const { data } = await supabaseAdmin
    .from("ai_playbooks").select("id")
    .eq("organization_id", orgId).eq("playbook_id", playbookId).maybeSingle();
  return (data as { id: string } | null)?.id ?? null;
}

// ---------- Evidence ----------
export class SupabaseEvidenceRepository implements EvidenceRepository {
  async save(e: PersistedEvidence): Promise<PersistedEvidence> {
    const { error } = await supabaseAdmin.from("ai_evidence").upsert({
      organization_id: e.organizationId,
      evidence_id: e.evidenceId,
      expert_id: e.expertId,
      sources: e.sources,
      missing: e.missing,
      confidence: e.confidence,
    }, { onConflict: "organization_id,evidence_id" });
    if (error) throw new Error(`ai_evidence.save: ${error.message}`);
    return e;
  }
  async get(orgId: string, id: string): Promise<PersistedEvidence | null> {
    const { data } = await supabaseAdmin.from("ai_evidence").select("*")
      .eq("organization_id", orgId).eq("evidence_id", id).maybeSingle();
    return data ? rowToEvidence(data as EvidenceRow) : null;
  }
  async listByOrganization(orgId: string, limit = 100): Promise<PersistedEvidence[]> {
    const { data } = await supabaseAdmin.from("ai_evidence").select("*")
      .eq("organization_id", orgId).order("created_at", { ascending: false }).limit(limit);
    return (data ?? []).map((r) => rowToEvidence(r as EvidenceRow));
  }
}

// ---------- Playbooks ----------
export class SupabasePlaybookRepository implements PlaybookRepository {
  async save(p: PersistedPlaybook): Promise<PersistedPlaybook> {
    const evidenceUuid = await resolveEvidenceUuid(p.organizationId, p.evidenceId);
    const { error } = await supabaseAdmin.from("ai_playbooks").upsert({
      organization_id: p.organizationId,
      playbook_id: p.playbookId,
      title: p.title, problem: p.problem, diagnosis: p.diagnosis, impact: p.impact,
      urgency: p.urgency, complexity: p.complexity,
      checklist: p.checklist, action_plan: p.actionPlan,
      financial_estimate: p.financialEstimate,
      next_steps: p.nextSteps, success_criteria: p.successCriteria,
      expected_outcome: p.expectedOutcome, version: p.version,
      evidence_id: evidenceUuid,
    }, { onConflict: "organization_id,playbook_id" });
    if (error) throw new Error(`ai_playbooks.save: ${error.message}`);
    return p;
  }
  async get(orgId: string, id: string): Promise<PersistedPlaybook | null> {
    const { data } = await supabaseAdmin.from("ai_playbooks").select("*")
      .eq("organization_id", orgId).eq("playbook_id", id).maybeSingle();
    return data ? rowToPlaybook(data as PlaybookRow) : null;
  }
  async listByOrganization(orgId: string, limit = 100): Promise<PersistedPlaybook[]> {
    const { data } = await supabaseAdmin.from("ai_playbooks").select("*")
      .eq("organization_id", orgId).order("created_at", { ascending: false }).limit(limit);
    return (data ?? []).map((r) => rowToPlaybook(r as PlaybookRow));
  }
}

// ---------- Recommendations ----------
export class SupabaseRecommendationRepository implements RecommendationRepository {
  async save(r: PersistedRecommendation): Promise<PersistedRecommendation> {
    const [evidenceUuid, playbookUuid] = await Promise.all([
      resolveEvidenceUuid(r.organizationId, r.evidenceId),
      resolvePlaybookUuid(r.organizationId, r.playbookId),
    ]);
    const { error } = await supabaseAdmin.from("ai_recommendations").upsert({
      organization_id: r.organizationId,
      recommendation_id: r.recommendationId,
      expert_id: r.expertId,
      summary: r.summary, diagnosis: r.diagnosis, problem: r.problem, impact: r.impact,
      financial_value_cents: r.financialValueCents,
      urgency: r.urgency, complexity: r.complexity,
      checklist: r.checklist,
      confidence: r.confidence, status: r.status,
      evidence_id: evidenceUuid, playbook_id: playbookUuid,
      workflow_id: r.workflowId, task_id: r.taskId,
    }, { onConflict: "organization_id,recommendation_id" });
    if (error) throw new Error(`ai_recommendations.save: ${error.message}`);
    return r;
  }
  async updateStatus(orgId: string, id: string, status: RecommendationStatus): Promise<void> {
    const { error } = await supabaseAdmin.from("ai_recommendations")
      .update({ status }).eq("organization_id", orgId).eq("recommendation_id", id);
    if (error) throw new Error(`ai_recommendations.updateStatus: ${error.message}`);
  }
  async get(orgId: string, id: string): Promise<PersistedRecommendation | null> {
    const { data } = await supabaseAdmin.from("ai_recommendations").select("*")
      .eq("organization_id", orgId).eq("recommendation_id", id).maybeSingle();
    return data ? rowToRecommendation(data as RecommendationRow) : null;
  }
  async listByOrganization(
    orgId: string, opts: { status?: RecommendationStatus; limit?: number } = {},
  ): Promise<PersistedRecommendation[]> {
    let q = supabaseAdmin.from("ai_recommendations").select("*")
      .eq("organization_id", orgId).order("created_at", { ascending: false })
      .limit(opts.limit ?? 100);
    if (opts.status) q = q.eq("status", opts.status);
    const { data } = await q;
    return (data ?? []).map((r) => rowToRecommendation(r as RecommendationRow));
  }
}

export function createSupabaseExpertRepositories(): ExpertRepositoryBundle {
  return {
    evidence: new SupabaseEvidenceRepository(),
    playbooks: new SupabasePlaybookRepository(),
    recommendations: new SupabaseRecommendationRepository(),
  };
}

// ---------- Row mappers ----------
function rowToEvidence(r: EvidenceRow): PersistedEvidence {
  return {
    evidenceId: r.evidence_id,
    organizationId: r.organization_id,
    expertId: r.expert_id as ExpertId,
    sources: (Array.isArray(r.sources) ? r.sources : []) as PersistedEvidence["sources"],
    missing: (Array.isArray(r.missing) ? r.missing : []) as PersistedEvidence["missing"],
    confidence: Number(r.confidence),
    createdAt: r.created_at,
  };
}
function rowToPlaybook(r: PlaybookRow): PersistedPlaybook {
  return {
    playbookId: r.playbook_id,
    organizationId: r.organization_id,
    title: r.title, problem: r.problem, diagnosis: r.diagnosis, impact: r.impact,
    urgency: r.urgency as PersistedPlaybook["urgency"],
    complexity: r.complexity as PersistedPlaybook["complexity"],
    checklist: (Array.isArray(r.checklist) ? r.checklist : []) as PersistedPlaybook["checklist"],
    actionPlan: (Array.isArray(r.action_plan) ? r.action_plan : []) as PersistedPlaybook["actionPlan"],
    financialEstimate: (r.financial_estimate ?? { costCents: 0, savingsCents: 0, paybackDays: 0 }) as PersistedPlaybook["financialEstimate"],
    nextSteps: (Array.isArray(r.next_steps) ? r.next_steps : []) as string[],
    successCriteria: (Array.isArray(r.success_criteria) ? r.success_criteria : []) as string[],
    expectedOutcome: r.expected_outcome,
    version: r.version,
    // FK evidence_id resolves to UUID; the domain layer stores the text id.
    // We cannot round-trip the text id from the FK alone; downstream reads
    // typically use `evidence_id` only for joins, so we expose null when the
    // caller did not fetch it explicitly.
    evidence_reference_uuid: r.evidence_id,
    evidenceId: null,
    createdAt: r.created_at,
  } as unknown as PersistedPlaybook;
}
function rowToRecommendation(r: RecommendationRow): PersistedRecommendation {
  return {
    recommendationId: r.recommendation_id,
    organizationId: r.organization_id,
    expertId: r.expert_id as ExpertId,
    summary: r.summary, diagnosis: r.diagnosis, problem: r.problem, impact: r.impact,
    financialValueCents: Number(r.financial_value_cents),
    urgency: r.urgency as PersistedRecommendation["urgency"],
    complexity: r.complexity as PersistedRecommendation["complexity"],
    checklist: (Array.isArray(r.checklist) ? r.checklist : []) as PersistedRecommendation["checklist"],
    confidence: Number(r.confidence),
    status: r.status as RecommendationStatus,
    evidenceId: r.evidence_id ?? "",
    playbookId: r.playbook_id,
    workflowId: r.workflow_id,
    taskId: r.task_id,
    createdAt: r.created_at,
  };
}
