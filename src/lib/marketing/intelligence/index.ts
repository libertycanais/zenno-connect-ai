// FEATURE — Marketing Intelligence · Public facade (additive)
export * from "./types";
export { computeMarketingHealth } from "./health/health-engine";
export { computeAIReadiness } from "./health/ai-readiness";
export { buildRecommendations } from "./recommendations/recommendation-pipeline";
export { buildExecutiveSummary } from "./executive/executive-summary";
export { runMarketingExperts } from "./analysis/expert-runner";
export { updateMarketingContext, getMarketingContext, clearMarketingContext } from "./context/context-updater";
export { recordTimeline, listTimeline, clearTimeline } from "./timeline/timeline-recorder";
export { recordRun, getRuns, clearRuns } from "./metrics/observability";
export { runMarketingIntelligencePipeline, clearPipelineCache } from "./pipeline/marketing-intelligence-pipeline";
export { orchestrateAfterSync } from "./orchestrator/orchestrator";
export { makePipelineJob, runPipelineJob } from "./jobs/pipeline-job";
