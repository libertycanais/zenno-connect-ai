// EPIC A — Zenno Brain · AI Timeline contracts
import type { AIProviderName, TaskStatus } from "../types";

export type TimelineStage =
  | "task_created" | "policy_checked" | "rules_evaluated" | "context_assembled"
  | "plan_built" | "workflow_built" | "provider_selected" | "provider_called"
  | "response_validated" | "post_processed" | "recommendation_generated"
  | "artifact_created" | "task_completed" | "task_failed";

export type TimelineEntry = {
  entryId: string;
  organizationId: string;
  taskId: string;
  planId: string | null;
  workflowId: string | null;
  stage: TimelineStage;
  timestamp: string;
  latencyMs: number | null;
  tokensIn: number | null;
  tokensOut: number | null;
  provider: AIProviderName | null;
  model: string | null;
  skill: string | null;
  costCents: number | null;
  status: TaskStatus | "pending";
  reasonCode: string | null;
  meta: Record<string, unknown>;
};

export type TimelineWrite = Omit<TimelineEntry, "entryId" | "timestamp">;
