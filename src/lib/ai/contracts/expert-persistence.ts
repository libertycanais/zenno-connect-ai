// EPIC D — AI Execution & Persistence · Expert output stores
// Contracts for persisting Recommendations / Evidence / Playbooks produced
// by any Expert (Marketing today, Sales/Finance/etc. next).
//
// In-memory reference implementation lives in `src/lib/ai/persistence/experts.ts`.
// The Supabase-backed implementation lives in `experts.server.ts` (server-only).

import type { EvidenceBundle } from "../evidence";
import type { Playbook } from "../playbooks";
import type { Recommendation } from "../recommendation";
import type { ExpertId } from "../experts/types";

export type RecommendationStatus =
  | "open" | "in_progress" | "resolved" | "dismissed" | "archived";

export type PersistedEvidence = EvidenceBundle & { expertId: ExpertId };
export type PersistedPlaybook = Playbook & { evidenceId: string | null };
export type PersistedRecommendation = Recommendation & {
  expertId: ExpertId;
  status: RecommendationStatus;
  workflowId: string | null;
  taskId: string | null;
};

export interface EvidenceRepository {
  save(evidence: PersistedEvidence): Promise<PersistedEvidence>;
  get(organizationId: string, evidenceId: string): Promise<PersistedEvidence | null>;
  listByOrganization(organizationId: string, limit?: number): Promise<PersistedEvidence[]>;
}

export interface PlaybookRepository {
  save(playbook: PersistedPlaybook): Promise<PersistedPlaybook>;
  get(organizationId: string, playbookId: string): Promise<PersistedPlaybook | null>;
  listByOrganization(organizationId: string, limit?: number): Promise<PersistedPlaybook[]>;
}

export interface RecommendationRepository {
  save(rec: PersistedRecommendation): Promise<PersistedRecommendation>;
  updateStatus(organizationId: string, recommendationId: string, status: RecommendationStatus): Promise<void>;
  get(organizationId: string, recommendationId: string): Promise<PersistedRecommendation | null>;
  listByOrganization(organizationId: string, opts?: {
    status?: RecommendationStatus; limit?: number;
  }): Promise<PersistedRecommendation[]>;
}

export type ExpertRepositoryBundle = {
  evidence: EvidenceRepository;
  playbooks: PlaybookRepository;
  recommendations: RecommendationRepository;
};
