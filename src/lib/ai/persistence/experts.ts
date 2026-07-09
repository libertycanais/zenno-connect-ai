// EPIC D — In-memory reference implementation for Expert repositories.
// Zero I/O; used by tests, local execution, and as a fallback bundle.

import type {
  EvidenceRepository, PlaybookRepository, RecommendationRepository,
  PersistedEvidence, PersistedPlaybook, PersistedRecommendation,
  RecommendationStatus, ExpertRepositoryBundle,
} from "../contracts/expert-persistence";

function keyOf(orgId: string, id: string): string { return `${orgId}::${id}`; }

export class InMemoryEvidenceRepository implements EvidenceRepository {
  private m = new Map<string, PersistedEvidence>();
  async save(e: PersistedEvidence): Promise<PersistedEvidence> {
    const copy: PersistedEvidence = { ...e, sources: [...e.sources], missing: [...e.missing] };
    this.m.set(keyOf(e.organizationId, e.evidenceId), copy);
    return copy;
  }
  async get(orgId: string, id: string): Promise<PersistedEvidence | null> {
    return this.m.get(keyOf(orgId, id)) ?? null;
  }
  async listByOrganization(orgId: string, limit = 100): Promise<PersistedEvidence[]> {
    return [...this.m.values()].filter((x) => x.organizationId === orgId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, limit);
  }
}

export class InMemoryPlaybookRepository implements PlaybookRepository {
  private m = new Map<string, PersistedPlaybook>();
  async save(p: PersistedPlaybook): Promise<PersistedPlaybook> {
    const copy: PersistedPlaybook = {
      ...p,
      checklist: [...p.checklist],
      actionPlan: [...p.actionPlan],
      nextSteps: [...p.nextSteps],
      successCriteria: [...p.successCriteria],
    };
    this.m.set(keyOf(p.organizationId, p.playbookId), copy);
    return copy;
  }
  async get(orgId: string, id: string): Promise<PersistedPlaybook | null> {
    return this.m.get(keyOf(orgId, id)) ?? null;
  }
  async listByOrganization(orgId: string, limit = 100): Promise<PersistedPlaybook[]> {
    return [...this.m.values()].filter((x) => x.organizationId === orgId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, limit);
  }
}

export class InMemoryRecommendationRepository implements RecommendationRepository {
  private m = new Map<string, PersistedRecommendation>();
  async save(r: PersistedRecommendation): Promise<PersistedRecommendation> {
    const copy: PersistedRecommendation = { ...r, checklist: [...r.checklist] };
    this.m.set(keyOf(r.organizationId, r.recommendationId), copy);
    return copy;
  }
  async updateStatus(orgId: string, id: string, status: RecommendationStatus): Promise<void> {
    const cur = this.m.get(keyOf(orgId, id));
    if (cur) this.m.set(keyOf(orgId, id), { ...cur, status });
  }
  async get(orgId: string, id: string): Promise<PersistedRecommendation | null> {
    return this.m.get(keyOf(orgId, id)) ?? null;
  }
  async listByOrganization(
    orgId: string, opts: { status?: RecommendationStatus; limit?: number } = {},
  ): Promise<PersistedRecommendation[]> {
    const { status, limit = 100 } = opts;
    return [...this.m.values()]
      .filter((x) => x.organizationId === orgId && (status ? x.status === status : true))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, limit);
  }
}

export function createInMemoryExpertRepositories(): ExpertRepositoryBundle {
  return {
    evidence: new InMemoryEvidenceRepository(),
    playbooks: new InMemoryPlaybookRepository(),
    recommendations: new InMemoryRecommendationRepository(),
  };
}
