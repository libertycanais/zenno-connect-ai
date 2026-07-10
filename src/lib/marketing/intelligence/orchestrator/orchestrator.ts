// FEATURE — Marketing Intelligence · Orchestrator
// Entry point invoked after a sync completes. Emits canonical events so any
// module can subscribe (Task Engine, Copilot, Command Center, Notifications).
// First Five Minutes: tracks TTFI and enqueues a discreet Copilot briefing
// (never auto-opens the Copilot — user decides).
import { runMarketingIntelligencePipeline } from "../pipeline/marketing-intelligence-pipeline";
import { emit } from "../events/event-bus";
import { startTTFI, completeTTFI } from "../first-five-minutes/ttfi-tracker";
import { enqueueBriefingNotification } from "../first-five-minutes/briefing-notification";
import { buildProactiveBriefing } from "../copilot/proactive-briefing";
import { getSnapshot } from "../snapshot/snapshot-store";
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

  // First Five Minutes — close TTFI + enqueue a discreet briefing (never auto-open).
  completeTTFI(input.organizationId, input.connectionId);
  const snapshot = getSnapshot(input.organizationId);
  if (snapshot) enqueueBriefingNotification(input.organizationId, buildProactiveBriefing(snapshot));

  return pipeline;
}

export function notifyPlatformConnected(input: Omit<PipelineInput, "campaigns" | "tracking">): void {
  emit("MarketingPlatformConnected", {
    organizationId: input.organizationId,
    provider: input.provider,
    connectionId: input.connectionId,
    at: new Date().toISOString(),
  });
  // First Five Minutes — start TTFI clock the moment the platform connects.
  startTTFI(input.organizationId, input.connectionId);
}
