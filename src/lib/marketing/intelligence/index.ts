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
export { orchestrateAfterSync, notifyPlatformConnected } from "./orchestrator/orchestrator";
export { makePipelineJob, runPipelineJob } from "./jobs/pipeline-job";

// Marketing Intelligence Experience (additive)
export { on as onMarketingEvent, emit as emitMarketingEvent, clearAllListeners as clearMarketingListeners, listenerCount as marketingListenerCount } from "./events/event-bus";
export type { MarketingEvent, MarketingEventName, MarketingEventMap } from "./events/events";
export { computeIntelligenceScore } from "./score/intelligence-score";
export type { IntelligenceScoreResult, IntelligenceScoreBreakdown, IntelligenceScoreInput } from "./score/intelligence-score";
export { getSnapshot, listSnapshotHistory, updateSnapshotFromPipeline, clearSnapshots } from "./snapshot/snapshot-store";
export type { MarketingIntelligenceSnapshot, MarketingIntelligenceHistoryEntry } from "./snapshot/snapshot-store";
export { buildProactiveBriefing } from "./copilot/proactive-briefing";
export type { ProactiveBriefing } from "./copilot/proactive-briefing";

// First Five Minutes (additive UX refinement — no arch change)
export { computeAIConfidence, computeAIConfidenceFromPipeline } from "./confidence/ai-confidence";
export type { AIConfidenceResult, AIConfidenceInput, AIConfidenceBasis } from "./confidence/ai-confidence";
export { explainIntelligenceScore } from "./score/score-explainer";
export type { ScoreExplanation } from "./score/score-explainer";
export {
  startTTFI, completeTTFI, getActiveTTFI, getLastTTFI, averageTTFIms, clearTTFI, formatTTFI,
} from "./first-five-minutes/ttfi-tracker";
export type { TTFIRun } from "./first-five-minutes/ttfi-tracker";
export { buildOnboardingChecklist } from "./first-five-minutes/onboarding-checklist";
export type { OnboardingChecklist, OnboardingItem, OnboardingInput } from "./first-five-minutes/onboarding-checklist";
export {
  enqueueBriefingNotification, getPendingBriefing, markBriefingSeen, dismissBriefing,
  listBriefings, clearBriefings,
} from "./first-five-minutes/briefing-notification";
export type { BriefingNotification } from "./first-five-minutes/briefing-notification";