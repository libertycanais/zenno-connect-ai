// EPIC B — AI Execution Platform · In-memory persistence (reference impl)
// DB-backed implementations live in `*.server.ts` and consume RLS-scoped
// Supabase clients. Nothing here touches the network.

import type { Workflow, WorkflowStep } from "../contracts/workflow";
import type { TimelineEntry, TimelineWrite } from "../contracts/timeline";
import type { DecisionGraph, DecisionNode, DecisionEdge } from "../contracts/decision";
import type { ExecutionResult, StepExecutionResult } from "../contracts/executor";
import type { FeatureFlagRule } from "../contracts/feature-flags";
import type { CapabilityRow } from "../contracts/capability";
import type {
  WorkflowStore, TimelineStoreAsync, DecisionGraphStore,
  ExecutionResultStore, FeatureFlagStore, CapabilityMatrixStore,
} from "../contracts/persistence";

export class InMemoryWorkflowStore implements WorkflowStore {
  private m = new Map<string, Workflow>();
  async saveWorkflow(w: Workflow): Promise<void> { this.m.set(w.workflowId, { ...w, steps: w.steps.map((s) => ({ ...s })) }); }
  async updateStep(workflowId: string, step: WorkflowStep): Promise<void> {
    const w = this.m.get(workflowId); if (!w) return;
    const i = w.steps.findIndex((s) => s.id === step.id); if (i >= 0) w.steps[i] = { ...step };
  }
  async getWorkflow(workflowId: string): Promise<Workflow | null> { return this.m.get(workflowId) ?? null; }
  async listByOrganization(organizationId: string): Promise<Workflow[]> {
    return [...this.m.values()].filter((w) => w.organizationId === organizationId);
  }
}

export class InMemoryTimelineStoreAsync implements TimelineStoreAsync {
  private m = new Map<string, TimelineEntry[]>();
  private seq = 0;
  async append(entry: TimelineWrite): Promise<TimelineEntry> {
    const full: TimelineEntry = { ...entry, entryId: `tl_${(this.seq++).toString(36)}`, timestamp: new Date().toISOString() };
    const list = this.m.get(entry.taskId) ?? []; list.push(full); this.m.set(entry.taskId, list);
    return full;
  }
  async forTask(taskId: string): Promise<TimelineEntry[]> { return [...(this.m.get(taskId) ?? [])]; }
}

export class InMemoryDecisionGraphStore implements DecisionGraphStore {
  private m = new Map<string, DecisionGraph>();
  async saveGraph(g: DecisionGraph): Promise<void> {
    this.m.set(g.graphId, { ...g, nodes: [...g.nodes], edges: [...g.edges] });
  }
  async appendNode(graphId: string, node: DecisionNode): Promise<void> {
    const g = this.m.get(graphId); if (g) g.nodes.push(node);
  }
  async appendEdge(graphId: string, edge: DecisionEdge): Promise<void> {
    const g = this.m.get(graphId); if (g) g.edges.push(edge);
  }
  async getGraph(graphId: string): Promise<DecisionGraph | null> { return this.m.get(graphId) ?? null; }
}

export class InMemoryExecutionResultStore implements ExecutionResultStore {
  private m = new Map<string, ExecutionResult>();
  async save(result: ExecutionResult): Promise<void> { this.m.set(result.workflowId, { ...result, stepResults: [...result.stepResults] }); }
  async get(workflowId: string): Promise<ExecutionResult | null> { return this.m.get(workflowId) ?? null; }
  async listByOrganization(organizationId: string): Promise<ExecutionResult[]> {
    return [...this.m.values()].filter((r) => r.organizationId === organizationId);
  }
  async appendStep(workflowId: string, step: StepExecutionResult): Promise<void> {
    const r = this.m.get(workflowId);
    if (r) r.stepResults.push(step);
  }
}

export class InMemoryFeatureFlagStore implements FeatureFlagStore {
  private m = new Map<string, FeatureFlagRule>();
  async list(): Promise<FeatureFlagRule[]> { return [...this.m.values()]; }
  async upsert(rule: FeatureFlagRule): Promise<void> { this.m.set(rule.key, rule); }
}

export class InMemoryCapabilityMatrixStore implements CapabilityMatrixStore {
  private rows: CapabilityRow[] = [];
  async list(): Promise<CapabilityRow[]> { return [...this.rows]; }
  async register(row: CapabilityRow): Promise<void> { this.rows.push(row); }
  async deactivate(provider: string, model: string, skill: string): Promise<void> {
    for (const r of this.rows) if (r.provider === provider && r.model === model && r.skill === skill) r.active = false;
  }
}
