// EPIC B — AI Execution Platform · Executor / Execution contracts
import type { AIProviderName } from "../types";
import type { Workflow, WorkflowStep } from "./workflow";
import type { AdapterResponse } from "../provider-adapter";

export type ExecutionEventName =
  | "ExecutionStarted"
  | "ExecutionFinished"
  | "ExecutionFailed"
  | "WorkflowCancelled"
  | "ProviderFallback"
  | "CircuitBreakerOpened"
  | "RetryExecuted"
  | "BudgetExceeded"
  | "StepStarted"
  | "StepFinished"
  | "StepFailed";

export type ExecutionEvent = {
  name: ExecutionEventName;
  organizationId: string;
  workflowId: string;
  stepId: string | null;
  provider: AIProviderName | null;
  model: string | null;
  timestamp: string;
  meta: Record<string, unknown>;
};

export type StepExecutionResult = {
  stepId: string;
  skill: string;
  status: "succeeded" | "failed" | "skipped" | "cancelled";
  provider: AIProviderName | null;
  model: string | null;
  tokensIn: number;
  tokensOut: number;
  costCents: number;
  latencyMs: number;
  attempts: number;
  fallbackUsed: boolean;
  reasonCode: string;
  response: AdapterResponse | null;
  error: string | null;
};

export type ExecutionResult = {
  workflowId: string;
  organizationId: string;
  status: "completed" | "failed" | "cancelled" | "partial";
  startedAt: string;
  finishedAt: string;
  totalLatencyMs: number;
  totalCostCents: number;
  totalTokens: number;
  stepResults: StepExecutionResult[];
  reasonCodes: string[];
};

export type ExecutionBudget = {
  maxCostCents: number;
  maxLatencyMs: number;
  maxSteps: number;
};

export type ExecutionOptions = {
  budget: ExecutionBudget;
  parallelism?: number;
  abortSignal?: AbortSignal;
  featureFlags?: string[];
};

export type ExecutionContext = {
  workflow: Workflow;
  options: ExecutionOptions;
};

export type StepExecutor = (
  step: WorkflowStep, ctx: ExecutionContext,
) => Promise<StepExecutionResult>;
