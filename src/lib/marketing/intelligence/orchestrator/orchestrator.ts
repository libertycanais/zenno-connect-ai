// FEATURE — Marketing Intelligence · Orchestrator
// Entry point invoked after a sync completes. Emits canonical events so any
// module can subscribe (Task Engine, Copilot, Command Center, Notifications).
import { runMarketingIntelligencePipeline } from "../pipeline/marketing-intelligence-pipeline";
import { emit } from "../events/event-bus";
import type { PipelineInput, PipelineResult } from "../types";

export async function orchestrateAfterSync(input: PipelineInput): Promise<PipelineResult> {
  const base = {
    organizationId: input.organizationId,
    provider: input.provider,
    connectionId: input.connectionId,
    at: new Date().toISOString(),
  };
  emit("MarketingSyncStarted", base);
  const pipeline = runMarketingIntelligencePipeline(input);
  emit("MarketingSyncCompleted", { ...base, at: new Date().toISOString(), pipeline });
  return pipeline;
}

export function notifyPlatformConnected(input: Omit<PipelineInput, "campaigns" | "tracking">): void {
  emit("MarketingPlatformConnected", {
    organizationId: input.organizationId,
    provider: input.provider,
    connectionId: input.connectionId,
    at: new Date().toISOString(),
  });
}