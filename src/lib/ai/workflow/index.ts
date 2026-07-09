// EPIC A — Zenno Brain · Workflow Builder
// Converts an approved Plan into an executable Workflow. Deterministic
// fingerprint enables replay/cache lookup. No provider calls happen here.

import type {
  Workflow, WorkflowStep, WorkflowBuildOptions,
} from "../contracts/workflow";
import type { Plan } from "../contracts/planner";

export * from "../contracts/workflow";

function fingerprint(input: string): string {
  let h = 5381;
  for (let i = 0; i < input.length; i++) h = ((h << 5) + h + input.charCodeAt(i)) >>> 0;
  return h.toString(16).padStart(16, "0").slice(0, 16);
}

function nextWorkflowId(): string {
  return `wf_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export class WorkflowBuilder {
  build(plan: Plan, options: WorkflowBuildOptions = {}): Workflow {
    const version = options.version ?? "1.0.0";
    const steps: WorkflowStep[] = plan.steps.map((s) => ({
      id: `${plan.planId}:step:${s.index}`,
      name: s.skillId,
      priority: s.priority,
      provider: options.overrideProvider ?? s.provider,
      model: options.overrideModel ?? s.model,
      skill: s.skillId,
      dependencies: s.dependsOn.map((d) => `${plan.planId}:step:${d}`),
      estimatedCost: s.estimatedCostCents,
      estimatedLatency: s.estimatedLatencyMs,
      requiredCapabilities: s.requiredCapabilities,
      status: s.dependsOn.length === 0 ? "ready" : "pending",
    }));

    const normalized = JSON.stringify(
      steps.map((s) => [s.id, s.skill, s.provider, s.model, s.dependencies]),
    );
    return {
      workflowId: nextWorkflowId(),
      planId: plan.planId,
      organizationId: plan.organizationId,
      fingerprint: fingerprint(normalized),
      version,
      steps,
      createdAt: new Date().toISOString(),
      status: "ready",
    };
  }

  /** Returns steps whose dependencies are all satisfied by `completedIds`. */
  ready(workflow: Workflow, completedIds: Set<string>): WorkflowStep[] {
    return workflow.steps.filter(
      (s) => s.status === "pending" &&
        s.dependencies.every((d) => completedIds.has(d)),
    );
  }
}

export const workflowBuilder = new WorkflowBuilder();
