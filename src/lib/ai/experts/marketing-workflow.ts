// EPIC D — Marketing Expert × WorkflowExecutor integration.
// 100% additive. Uses the existing WorkflowExecutor (Epic B) for telemetry,
// budget, retry and provider fallback, and the ExpertService (Epic D) for
// structured persistence of Evidence / Playbook / Recommendation.
//
// Composition (no modification to WorkflowExecutor or MarketingExpert):
//   1. Build a Workflow with a single "marketing_analysis" step;
//   2. Execute it via WorkflowExecutor → provider bridge → telemetry;
//   3. Run MarketingExpert.run(input) locally (deterministic, side-effect free);
//   4. Persist outputs via ExpertService (Evidence → Playbook → Recommendation).
//
// The provider call is intentionally decoupled from the deterministic
// structured output. Claude / GPT enrichment lands as free-text `response`
// on the ExecutionResult, while the Expert layer remains the source of truth
// for structured recommendations.

import type { Workflow } from "../contracts/workflow";
import type { ExecutionResult, ExecutionOptions } from "../contracts/executor";
import type { AIAgent } from "../types";
import { WorkflowExecutor, type WorkflowExecutorDeps } from "../executor";
import { MarketingExpert } from "./marketing";
import { ExpertService, type ExpertRunPersisted, type ExpertServiceContext } from "./service";
import type { ExpertRunInput } from "./types";
import type { ExpertRepositoryBundle } from "../contracts/expert-persistence";
import { createInMemoryExpertRepositories } from "../persistence/experts";

export type MarketingWorkflowInput = ExpertRunInput & {
  agent: AIAgent;
  plan: string;
  role: string;
  taskId: string;
};

export type MarketingWorkflowResult = {
  workflowId: string;
  execution: ExecutionResult;
  expert: ExpertRunPersisted;
};

export type MarketingWorkflowRunnerDeps = {
  executor?: WorkflowExecutor;
  executorDeps?: WorkflowExecutorDeps;
  repositories?: ExpertRepositoryBundle;
  now?: () => number;
};

const DEFAULT_BUDGET: ExecutionOptions = {
  budget: { maxCostCents: 500, maxLatencyMs: 30_000, maxSteps: 4 },
  parallelism: 1,
};

export class MarketingWorkflowRunner {
  private readonly executor: WorkflowExecutor;
  private readonly service: ExpertService;
  private readonly now: () => number;

  constructor(deps: MarketingWorkflowRunnerDeps = {}) {
    this.executor = deps.executor ?? new WorkflowExecutor(deps.executorDeps ?? {});
    this.service = new ExpertService(
      new MarketingExpert(),
      deps.repositories ?? createInMemoryExpertRepositories(),
    );
    this.now = deps.now ?? Date.now;
  }

  async run(
    input: MarketingWorkflowInput,
    options: ExecutionOptions = DEFAULT_BUDGET,
  ): Promise<MarketingWorkflowResult> {
    const workflow = buildMarketingWorkflow(input, this.now());
    const execution = await this.executor.execute(workflow, {
      organizationId: input.organizationId,
      agent: input.agent,
      plan: input.plan,
      role: input.role,
      taskId: input.taskId,
    }, options);

    const persisted = await this.service.runAndPersist(input, {
      workflowId: workflow.workflowId,
      taskId: input.taskId,
      initialStatus: "open",
    });

    return { workflowId: workflow.workflowId, execution, expert: persisted };
  }
}

function buildMarketingWorkflow(input: MarketingWorkflowInput, ts: number): Workflow {
  const id = `wf_mkt_${ts.toString(36)}`;
  return {
    workflowId: id,
    organizationId: input.organizationId,
    planId: `plan_mkt_${ts.toString(36)}`,
    fingerprint: `mkt.${input.triggeredRules.map((r) => r.id).sort().join(",")}`,
    createdAt: new Date(ts).toISOString(),
    steps: [{
      id: `${id}.s1`,
      skill: "marketing_analysis",
      provider: null,
      model: null,
      dependencies: [],
      estimatedCost: 100,
      estimatedLatencyMs: 8_000,
      requiredCapabilities: ["reasoning"],
      status: "ready",
    }],
  };
}
