// EPIC B — AI Execution Platform · Workflow Executor
// Executes a Workflow respecting dependencies, parallelism, budget, timeout,
// circuit breaker, retry policy and provider fallback. Persistence is done
// through injected async stores (defaults: in-memory).

import type { Workflow, WorkflowStep, WorkflowStepStatus } from "../contracts/workflow";
import type {
  ExecutionOptions, ExecutionResult, ExecutionEvent, StepExecutionResult,
} from "../contracts/executor";
import type {
  WorkflowStore, TimelineStoreAsync, ExecutionResultStore,
} from "../contracts/persistence";
import { InMemoryWorkflowStore, InMemoryTimelineStoreAsync, InMemoryExecutionResultStore } from "../persistence";
import type { ProviderBridge } from "../bridge";
import { providerBridge as defaultBridge } from "../bridge";
import { skillRouter, type SkillRouter } from "../skill-router";
import { pickFallback } from "../fallback";
import { executionMetrics, ExecutionMetrics } from "../metrics";
import { capabilityMatrix } from "../capability-matrix";
import type { AIAgent } from "../types";

export type WorkflowExecutorDeps = {
  bridge?: ProviderBridge;
  router?: SkillRouter;
  metrics?: ExecutionMetrics;
  workflowStore?: WorkflowStore;
  timeline?: TimelineStoreAsync;
  resultStore?: ExecutionResultStore;
  onEvent?: (event: ExecutionEvent) => void;
  now?: () => number;
};

export type WorkflowExecutionContext = {
  organizationId: string;
  agent: AIAgent;
  plan: string;
  role: string;
  taskId: string;
};

export class WorkflowExecutor {
  private readonly bridge: ProviderBridge;
  private readonly router: SkillRouter;
  private readonly metrics: ExecutionMetrics;
  private readonly workflowStore: WorkflowStore;
  private readonly timeline: TimelineStoreAsync;
  private readonly resultStore: ExecutionResultStore;
  private readonly onEvent: (event: ExecutionEvent) => void;
  private readonly now: () => number;

  constructor(deps: WorkflowExecutorDeps = {}) {
    this.bridge = deps.bridge ?? defaultBridge;
    this.router = deps.router ?? skillRouter;
    this.metrics = deps.metrics ?? executionMetrics;
    this.workflowStore = deps.workflowStore ?? new InMemoryWorkflowStore();
    this.timeline = deps.timeline ?? new InMemoryTimelineStoreAsync();
    this.resultStore = deps.resultStore ?? new InMemoryExecutionResultStore();
    this.onEvent = deps.onEvent ?? (() => {});
    this.now = deps.now ?? Date.now;
  }

  async execute(
    workflow: Workflow, ctx: WorkflowExecutionContext, options: ExecutionOptions,
  ): Promise<ExecutionResult> {
    await this.workflowStore.saveWorkflow(workflow);
    const startedAt = new Date().toISOString();
    const t0 = this.now();
    this.emit({
      name: "ExecutionStarted", organizationId: ctx.organizationId,
      workflowId: workflow.workflowId, stepId: null, provider: null, model: null,
      timestamp: startedAt, meta: { budget: options.budget },
    });

    const completed = new Set<string>();
    const stepResults: StepExecutionResult[] = [];
    const reasonCodes: string[] = [];
    let spentCents = 0;
    let status: ExecutionResult["status"] = "completed";
    const parallelism = Math.max(1, options.parallelism ?? 2);

    while (completed.size < workflow.steps.length) {
      if (options.abortSignal?.aborted) {
        status = "cancelled";
        this.emit({
          name: "WorkflowCancelled", organizationId: ctx.organizationId,
          workflowId: workflow.workflowId, stepId: null, provider: null, model: null,
          timestamp: new Date().toISOString(), meta: {},
        });
        break;
      }
      const ready = workflow.steps.filter(
        (s) => s.status === "pending" || s.status === "ready",
      ).filter((s) => s.dependencies.every((d) => completed.has(d)));
      if (ready.length === 0) { status = "failed"; reasonCodes.push("no_ready_steps"); break; }

      const batch = ready.slice(0, parallelism);
      const results = await Promise.all(
        batch.map((step) => this.runStep(step, workflow, ctx, options, spentCents)),
      );

      for (const r of results) {
        stepResults.push(r);
        spentCents += r.costCents;
        completed.add(r.stepId);
        this.metrics.recordStep(r);
        await this.resultStore.appendStep(workflow.workflowId, r);
        await this.updateStepStatus(workflow, r.stepId, r.status === "succeeded" ? "succeeded" : "failed");
        if (r.status === "failed") {
          status = "failed";
          reasonCodes.push(`step_failed:${r.stepId}:${r.reasonCode}`);
        }
        if (spentCents > options.budget.maxCostCents) {
          status = "failed";
          reasonCodes.push("budget_exceeded");
          this.emit({
            name: "BudgetExceeded", organizationId: ctx.organizationId,
            workflowId: workflow.workflowId, stepId: r.stepId, provider: r.provider, model: r.model,
            timestamp: new Date().toISOString(), meta: { spentCents, budget: options.budget.maxCostCents },
          });
          break;
        }
      }
      if (status === "failed") break;
      if ((this.now() - t0) > options.budget.maxLatencyMs) {
        status = "failed"; reasonCodes.push("latency_budget_exceeded"); break;
      }
    }

    const finishedAt = new Date().toISOString();
    const totalLatencyMs = this.now() - t0;
    const totalTokens = stepResults.reduce((s, x) => s + x.tokensIn + x.tokensOut, 0);
    const finalStatus: ExecutionResult["status"] =
      status === "cancelled" ? "cancelled"
      : status === "failed" ? "failed"
      : stepResults.some((r) => r.status === "failed") ? "partial" : "completed";

    const result: ExecutionResult = {
      workflowId: workflow.workflowId,
      organizationId: ctx.organizationId,
      status: finalStatus,
      startedAt, finishedAt,
      totalLatencyMs,
      totalCostCents: spentCents,
      totalTokens,
      stepResults,
      reasonCodes,
    };
    await this.resultStore.save(result);
    this.metrics.recordResult(result);
    this.emit({
      name: finalStatus === "completed" ? "ExecutionFinished" : "ExecutionFailed",
      organizationId: ctx.organizationId, workflowId: workflow.workflowId,
      stepId: null, provider: null, model: null,
      timestamp: finishedAt, meta: { status: finalStatus, reasonCodes, costCents: spentCents },
    });
    return result;
  }

  private async runStep(
    step: WorkflowStep, workflow: Workflow, ctx: WorkflowExecutionContext,
    options: ExecutionOptions, spentCents: number,
  ): Promise<StepExecutionResult> {
    const t0 = this.now();
    this.emit({
      name: "StepStarted", organizationId: ctx.organizationId,
      workflowId: workflow.workflowId, stepId: step.id, provider: step.provider, model: step.model,
      timestamp: new Date().toISOString(), meta: { skill: step.skill },
    });

    // Route: prefer the step's declared provider/model; if missing, ask router.
    let provider = step.provider;
    let model = step.model;
    let fallbackUsed = false;
    let reasonCode = "ok";
    const matches = capabilityMatrix.match({
      skill: step.skill, agent: ctx.agent, plan: ctx.plan, role: ctx.role,
      requiredCapabilities: step.requiredCapabilities,
    });
    if (!provider || !model) {
      const routed = this.router.route({ step, agent: ctx.agent, plan: ctx.plan, role: ctx.role });
      if (routed) { provider = routed.provider; model = routed.model; }
    }

    if (!provider || !model) {
      return this.failedStep(step, "no_route", "Nenhum provider elegível", null, null, t0);
    }

    if (spentCents + step.estimatedCost > options.budget.maxCostCents) {
      return this.failedStep(step, "budget_precheck", "Budget insuficiente", provider, model, t0);
    }

    // Guard: if the primary route is unhealthy, try fallback deterministically.
    const primary = { provider, model };
    const fb = pickFallback(primary, matches);
    if (this.bridge.get(provider) === undefined) {
      if (fb.used && fb.to && this.bridge.has(fb.to.provider)) {
        provider = fb.to.provider; model = fb.to.model; fallbackUsed = true;
        reasonCode = fb.reasonCode;
        this.emit({
          name: "ProviderFallback", organizationId: ctx.organizationId,
          workflowId: workflow.workflowId, stepId: step.id,
          provider, model, timestamp: new Date().toISOString(),
          meta: { from: primary, to: { provider, model }, reason: fb.reason },
        });
      } else {
        return this.failedStep(step, "no_adapter", `Sem adapter para ${provider}`, provider, model, t0);
      }
    }

    const invoke = await this.bridge.invoke(provider, model, {
      systemPrompt: `You are ${step.skill}.`,
      userPrompt: `Execute skill=${step.skill} inside workflow=${workflow.workflowId}`,
    }, { signal: options.abortSignal, timeoutMs: Math.min(options.budget.maxLatencyMs, 30_000) });

    if (invoke.breakerTripped) {
      this.emit({
        name: "CircuitBreakerOpened", organizationId: ctx.organizationId,
        workflowId: workflow.workflowId, stepId: step.id, provider, model,
        timestamp: new Date().toISOString(), meta: {},
      });
    }
    if (invoke.attempts > 1) {
      this.emit({
        name: "RetryExecuted", organizationId: ctx.organizationId,
        workflowId: workflow.workflowId, stepId: step.id, provider, model,
        timestamp: new Date().toISOString(), meta: { attempts: invoke.attempts },
      });
    }

    if (!invoke.response) {
      return {
        stepId: step.id, skill: step.skill, status: "failed",
        provider, model, tokensIn: 0, tokensOut: 0, costCents: 0,
        latencyMs: invoke.latencyMs, attempts: invoke.attempts,
        fallbackUsed, reasonCode: invoke.error ?? "unknown_error",
        response: null, error: invoke.error,
      };
    }

    const res = invoke.response;
    // Deterministic cost: ((in+out)/1M) * costPer1MTokens ~ approximate 200 cents.
    const costCents = Math.max(1, Math.ceil(((res.tokensIn + res.tokensOut) / 1_000_000) * 200));
    const out: StepExecutionResult = {
      stepId: step.id, skill: step.skill, status: "succeeded",
      provider, model, tokensIn: res.tokensIn, tokensOut: res.tokensOut,
      costCents, latencyMs: invoke.latencyMs, attempts: invoke.attempts,
      fallbackUsed, reasonCode,
      response: res, error: null,
    };

    await this.timeline.append({
      organizationId: ctx.organizationId, taskId: ctx.taskId,
      planId: workflow.planId, workflowId: workflow.workflowId,
      stage: "provider_called",
      latencyMs: invoke.latencyMs, tokensIn: res.tokensIn, tokensOut: res.tokensOut,
      provider, model, skill: step.skill, costCents, status: "running",
      reasonCode: null, meta: { fingerprint: workflow.fingerprint },
    });

    this.emit({
      name: "StepFinished", organizationId: ctx.organizationId,
      workflowId: workflow.workflowId, stepId: step.id, provider, model,
      timestamp: new Date().toISOString(),
      meta: { tokensIn: res.tokensIn, tokensOut: res.tokensOut, costCents },
    });
    return out;
  }

  private failedStep(
    step: WorkflowStep, code: string, msg: string,
    provider: WorkflowStep["provider"], model: string | null, t0: number,
  ): StepExecutionResult {
    this.emit({
      name: "StepFailed", organizationId: "unknown",
      workflowId: "unknown", stepId: step.id,
      provider, model, timestamp: new Date().toISOString(),
      meta: { reasonCode: code, msg },
    });
    return {
      stepId: step.id, skill: step.skill, status: "failed",
      provider, model, tokensIn: 0, tokensOut: 0, costCents: 0,
      latencyMs: this.now() - t0, attempts: 0, fallbackUsed: false,
      reasonCode: code, response: null, error: msg,
    };
  }

  private async updateStepStatus(workflow: Workflow, stepId: string, status: WorkflowStepStatus): Promise<void> {
    const step = workflow.steps.find((s) => s.id === stepId);
    if (!step) return;
    step.status = status;
    await this.workflowStore.updateStep(workflow.workflowId, step);
  }

  private emit(event: ExecutionEvent): void { this.onEvent(event); }
}
