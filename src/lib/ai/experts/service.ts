// EPIC D — Expert Persistence Service
// Orchestrates: Expert.run() → ExpertRepositoryBundle (save Evidence → Playbook → Recommendation).
// This is the single integration point between the Expert Layer and any
// persistence backend (in-memory for tests, Supabase for production).
//
// NEVER calls providers, NEVER touches the DB directly. All I/O flows through
// the injected repositories (dependency inversion).

import type {
  Expert, ExpertRunInput, ExpertRunOutput,
} from "./types";
import type {
  ExpertRepositoryBundle, PersistedEvidence, PersistedPlaybook,
  PersistedRecommendation, RecommendationStatus,
} from "../contracts/expert-persistence";

export type ExpertServiceContext = {
  workflowId?: string | null;
  taskId?: string | null;
  initialStatus?: RecommendationStatus;
};

export type ExpertRunPersisted = {
  output: ExpertRunOutput;
  persisted: {
    evidence: PersistedEvidence;
    playbooks: PersistedPlaybook[];
    recommendations: PersistedRecommendation[];
  };
};

export class ExpertService {
  constructor(
    private readonly expert: Expert,
    private readonly repos: ExpertRepositoryBundle,
  ) {}

  async runAndPersist(
    input: ExpertRunInput, ctx: ExpertServiceContext = {},
  ): Promise<ExpertRunPersisted> {
    const output = this.expert.run(input);
    const status: RecommendationStatus = ctx.initialStatus ?? "open";

    const evidence: PersistedEvidence = {
      ...output.evidence, expertId: output.expertId,
    };
    const savedEvidence = await this.repos.evidence.save(evidence);

    const savedPlaybooks: PersistedPlaybook[] = [];
    for (const pb of output.playbooks) {
      const p: PersistedPlaybook = { ...pb, evidenceId: savedEvidence.evidenceId };
      savedPlaybooks.push(await this.repos.playbooks.save(p));
    }

    const savedRecs: PersistedRecommendation[] = [];
    for (const rec of output.recommendations) {
      const r: PersistedRecommendation = {
        ...rec,
        expertId: output.expertId,
        status,
        workflowId: ctx.workflowId ?? null,
        taskId: ctx.taskId ?? null,
      };
      savedRecs.push(await this.repos.recommendations.save(r));
    }

    return {
      output,
      persisted: {
        evidence: savedEvidence,
        playbooks: savedPlaybooks,
        recommendations: savedRecs,
      },
    };
  }
}
