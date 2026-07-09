// EPIC A — Zenno Brain · Workflow Builder contracts
import type { AIProviderName } from "../types";
import type { Plan } from "./planner";

export type WorkflowStepStatus =
  | "pending" | "ready" | "running" | "succeeded" | "failed" | "skipped" | "cancelled";

export type WorkflowStep = {
  id: string;
  name: string;
  priority: number;
  provider: AIProviderName | null;
  model: string | null;
  skill: string;
  dependencies: string[];              // step ids
  estimatedCost: number;               // cents
  estimatedLatency: number;            // ms
  requiredCapabilities: Array<"reasoning" | "vision" | "tools" | "streaming">;
  status: WorkflowStepStatus;
};

export type Workflow = {
  workflowId: string;
  planId: string;
  organizationId: string;
  fingerprint: string;                 // sha256(16) of ordered steps
  version: string;
  steps: WorkflowStep[];
  createdAt: string;
  status: "draft" | "ready" | "running" | "completed" | "failed" | "aborted";
};

export type WorkflowBuildOptions = {
  workflowKey?: string;
  version?: string;
  overrideProvider?: AIProviderName;
  overrideModel?: string;
};

export type WorkflowBuilderInput = { plan: Plan; options?: WorkflowBuildOptions };
