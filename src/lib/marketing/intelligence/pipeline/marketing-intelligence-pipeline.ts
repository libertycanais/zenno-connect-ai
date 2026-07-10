// FEATURE — Marketing Intelligence · Pipeline (pure orchestrator)
import type { PipelineInput, PipelineResult } from "../types";
import { computeMarketingHealth } from "../health/health-engine";
import { computeAIReadiness } from "../health/ai-readiness";
import { buildRecommendations } from "../recommendations/recommendation-pipeline";
import { buildExecutiveSummary } from "../executive/executive-summary";
import { runMarketingExperts } from "../analysis/expert-runner";
import { updateMarketingContext } from "../context/context-updater";
import { recordTimeline } from "../timeline/timeline-recorder";
import { recordRun } from "../metrics/observability";
import { emit } from "../events/event-bus";
import { updateSnapshotFromPipeline } from "../snapshot/snapshot-store";

// Simple cache: skip re-analysis for the same connection within TTL
const cache = new Map<string, { at: number; result: PipelineResult }>();
const TTL_MS = 60_000;

export function runMarketingIntelligencePipeline(input: PipelineInput): PipelineResult {
  const cacheKey = `${input.organizationId}:${input.connectionId}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.at < TTL_MS) return cached.result;

  const t0 = Date.now();
  const campaigns = input.campaigns ?? [];
  const tracking = input.tracking;

  const ctxStart = Date.now();
  const health = computeMarketingHealth(campaigns, tracking);
  const aiReadiness = computeAIReadiness(campaigns, tracking);
  const contextMs = Date.now() - ctxStart;

  const expStart = Date.now();
  const { campaignsAnalyzed } = runMarketingExperts({
    organizationId: input.organizationId,
    focus: `analysis:${input.provider}`,
    campaigns,
  });
  const expertsMs = Date.now() - expStart;

  const recs = buildRecommendations({
    organizationId: input.organizationId,
    provider: input.provider,
    campaigns, tracking, health,
  });

  const execStart = Date.now();
  const executive = buildExecutiveSummary({
    organizationId: input.organizationId,
    provider: input.provider,
    health,
    recommendations: recs,
  });
  const executiveMs = Date.now() - execStart;

  const timelineIds: string[] = [];
  const push = (stage: Parameters<typeof recordTimeline>[0]["stage"], latencyMs = 0, meta?: Record<string, unknown>) => {
    timelineIds.push(
      recordTimeline({
        organizationId: input.organizationId,
        provider: input.provider,
        stage, status: "ok", latencyMs,
        source: "marketing-intelligence-pipeline",
        meta,
      }).id,
    );
  };

  push("experts.executed", expertsMs, { campaigns: campaignsAnalyzed });
  push("executive.generated", executiveMs);
  push("recommendations.generated", 0, { count: recs.length });
  push("health.updated", 0, { score: health.overall });

  const totalMs = Date.now() - t0;
  const metrics = {
    totalMs, contextMs, expertsMs, executiveMs,
    recommendationsCount: recs.length,
    campaignsAnalyzed,
    tokensUsed: 0, estimatedCostCents: 0,
    healthScore: health.overall,
    aiReadiness: aiReadiness.overall,
  };

  const result: PipelineResult = {
    organizationId: input.organizationId,
    provider: input.provider,
    connectionId: input.connectionId,
    health, aiReadiness,
    recommendations: recs,
    executive,
    metrics,
    timelineEventIds: timelineIds,
    completedAt: new Date().toISOString(),
  };

  updateMarketingContext(result);
  push("context.updated");
  recordRun(input.organizationId, metrics);
  cache.set(cacheKey, { at: Date.now(), result });
  return result;
}

export function clearPipelineCache(): void { cache.clear(); }
