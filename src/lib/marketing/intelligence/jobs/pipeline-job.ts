// FEATURE — Marketing Intelligence · Job wrapper
// Placeholder wrapper compatible with the existing Task Engine contract.
// Additive; wiring to the real Task Engine happens outside this module.
import { orchestrateAfterSync } from "../orchestrator/orchestrator";
import type { PipelineInput, PipelineResult } from "../types";

export type PipelineJob = {
  name: "marketing.intelligence.pipeline";
  payload: PipelineInput;
};

export function makePipelineJob(payload: PipelineInput): PipelineJob {
  return { name: "marketing.intelligence.pipeline", payload };
}

export async function runPipelineJob(job: PipelineJob): Promise<PipelineResult> {
  return orchestrateAfterSync(job.payload);
}
