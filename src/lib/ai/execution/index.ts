// EPIC B — AI Execution Platform · Execution Engine (facade)
// Composes Executor + Scheduler + Metrics + Persistence into a single entry
// point. Features (chat, cron, analyzers) import ONLY this module.

export { WorkflowExecutor } from "../executor";
export type { WorkflowExecutorDeps, WorkflowExecutionContext } from "../executor";
export { scheduler, ExecutionScheduler } from "../scheduler";
export type { ScheduledEntry } from "../scheduler";
export { executionMetrics, ExecutionMetrics } from "../metrics";
export type { ExecutionMetricsSnapshot, ProviderMetrics } from "../metrics";
export { providerBridge, ProviderBridge } from "../bridge";
export type { BridgeInvokeOptions, BridgeInvokeResult } from "../bridge";
export { skillRouter, SkillRouter } from "../skill-router";
export type { SkillRoute, SkillRouterInput } from "../skill-router";
export { pickFallback } from "../fallback";
export type { FallbackDecision } from "../fallback";
export {
  InMemoryWorkflowStore, InMemoryTimelineStoreAsync, InMemoryDecisionGraphStore,
  InMemoryExecutionResultStore, InMemoryFeatureFlagStore, InMemoryCapabilityMatrixStore,
} from "../persistence";
