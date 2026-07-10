// FEATURE — Marketing Intelligence · Orchestrator
// Entry point invoked after a sync completes. Kept sync/async agnostic
// so it can be dispatched by the Task Engine when wired at persistence layer.
import { runMarketingIntelligencePipeline } from "../pipeline/marketing-intelligence-pipeline";
import type { PipelineInput, PipelineResult } from "../types";

export async function orchestrateAfterSync(input: PipelineInput): Promise<PipelineResult> {
  // Additive: we keep it synchronous today; future work can defer via Task Engine.
  return runMarketingIntelligencePipeline(input);
}
