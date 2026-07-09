// EPIC B — AI Execution Platform · Persistence contracts
// Store interfaces used by the ExecutionEngine. In-memory reference
// implementations live in `src/lib/ai/persistence`. Real DB-backed
// implementations live under `*.server.ts` and use RLS-scoped clients.

import type { Workflow, WorkflowStep } from "./workflow";
import type { TimelineEntry, TimelineWrite } from "./timeline";
import type { DecisionGraph, DecisionNode, DecisionEdge } from "./decision";
import type { ExecutionResult, StepExecutionResult } from "./executor";
import type { FeatureFlagRule } from "./feature-flags";
import type { CapabilityRow } from "./capability";

export interface WorkflowStore {
  saveWorkflow(w: Workflow): Promise<void>;
  updateStep(workflowId: string, step: WorkflowStep): Promise<void>;
  getWorkflow(workflowId: string): Promise<Workflow | null>;
  listByOrganization(organizationId: string): Promise<Workflow[]>;
}

export interface TimelineStoreAsync {
  append(entry: TimelineWrite): Promise<TimelineEntry>;
  forTask(taskId: string): Promise<TimelineEntry[]>;
}

export interface DecisionGraphStore {
  saveGraph(g: DecisionGraph): Promise<void>;
  appendNode(graphId: string, node: DecisionNode): Promise<void>;
  appendEdge(graphId: string, edge: DecisionEdge): Promise<void>;
  getGraph(graphId: string): Promise<DecisionGraph | null>;
}

export interface ExecutionResultStore {
  save(result: ExecutionResult): Promise<void>;
  get(workflowId: string): Promise<ExecutionResult | null>;
  listByOrganization(organizationId: string): Promise<ExecutionResult[]>;
  appendStep(workflowId: string, step: StepExecutionResult): Promise<void>;
}

export interface FeatureFlagStore {
  list(): Promise<FeatureFlagRule[]>;
  upsert(rule: FeatureFlagRule): Promise<void>;
}

export interface CapabilityMatrixStore {
  list(): Promise<CapabilityRow[]>;
  register(row: CapabilityRow): Promise<void>;
  deactivate(provider: string, model: string, skill: string): Promise<void>;
}
