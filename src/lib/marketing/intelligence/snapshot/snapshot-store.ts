// FEATURE — Marketing Intelligence Experience · Snapshot aggregator + history
// Single object consumed by Command Center, Copilot, Executive, Workspace.
// Additive: does not replace Health/Readiness/Executive stores; it aggregates them.
import type { PipelineResult, CampaignFacts, TrackingFacts } from "../types";
import { computeIntelligenceScore, type IntelligenceScoreResult } from "../score/intelligence-score";
import { explainIntelligenceScore, type ScoreExplanation } from "../score/score-explainer";
import { computeAIConfidence, type AIConfidenceResult } from "../confidence/ai-confidence";

export type MarketingIntelligenceSnapshot = {
  organizationId: string;
  provider: PipelineResult["provider"];
  connectionId: string;
  score: IntelligenceScoreResult;
  explanation: ScoreExplanation;
  confidence: AIConfidenceResult;
  health: number;
  readiness: number;
  recommendationsCount: number;
  opportunitiesCount: number;
  risksCount: number;
  estimatedRoiCents: number;
  financialImpactCents: number;
  executiveSummary: string;
  topOpportunity: string | null;
  topRisk: string | null;
  lastAnalysisAt: string;
  weeklyDelta: number;   // score delta vs 7d ago (or oldest known)
};

export type MarketingIntelligenceHistoryEntry = {
  organizationId: string;
  provider: PipelineResult["provider"];
  connectionId: string;
  score: number;
  health: number;
  readiness: number;
  at: string;
};

const HISTORY_LIMIT = 500;
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

const snapshots = new Map<string, MarketingIntelligenceSnapshot>();
const history: MarketingIntelligenceHistoryEntry[] = [];

function key(organizationId: string): string { return organizationId; }

function computeWeeklyDelta(organizationId: string, currentScore: number): number {
  const cutoff = Date.now() - WEEK_MS;
  const older = history
    .filter((h) => h.organizationId === organizationId && new Date(h.at).getTime() <= cutoff)
    .pop();
  const baseline = older ?? history.find((h) => h.organizationId === organizationId);
  if (!baseline) return 0;
  return Math.round((currentScore - baseline.score) * 10) / 10;
}

export type SnapshotContext = {
  campaigns?: CampaignFacts[];
  tracking?: TrackingFacts;
  historyMonths?: number;
};

export function updateSnapshotFromPipeline(
  result: PipelineResult,
  ctx: SnapshotContext = {},
): MarketingIntelligenceSnapshot {
  const score = computeIntelligenceScore({
    health: result.health,
    readiness: result.aiReadiness,
    recommendations: result.recommendations,
  });

  const opps = result.recommendations.filter((r) => r.priority === "low" || r.priority === "medium").length;
  const risks = result.recommendations.filter((r) => r.priority === "high" || r.priority === "critical").length;

  const explanation = explainIntelligenceScore(score, { risksCount: risks, opportunitiesCount: opps });
  const confidence = computeAIConfidence({
    campaigns: ctx.campaigns,
    trackingCoverage: ctx.tracking?.coverage ?? result.aiReadiness.overall / 100,
    historyMonths: ctx.historyMonths,
  });

  const snapshot: MarketingIntelligenceSnapshot = {
    organizationId: result.organizationId,
    provider: result.provider,
    connectionId: result.connectionId,
    score,
    explanation,
    confidence,
    health: result.health.overall,
    readiness: result.aiReadiness.overall,
    recommendationsCount: result.recommendations.length,
    opportunitiesCount: opps,
    risksCount: risks,
    estimatedRoiCents: result.executive.estimatedRoiCents,
    financialImpactCents: result.executive.financialImpactCents,
    executiveSummary: result.executive.summary,
    topOpportunity: result.executive.topOpportunity,
    topRisk: result.executive.topRisk,
    lastAnalysisAt: result.completedAt,
    weeklyDelta: computeWeeklyDelta(result.organizationId, score.score),
  };

  snapshots.set(key(result.organizationId), snapshot);

  history.push({
    organizationId: result.organizationId,
    provider: result.provider,
    connectionId: result.connectionId,
    score: score.score,
    health: result.health.overall,
    readiness: result.aiReadiness.overall,
    at: result.completedAt,
  });
  if (history.length > HISTORY_LIMIT) history.splice(0, history.length - HISTORY_LIMIT);

  return snapshot;
}

export function getSnapshot(organizationId: string): MarketingIntelligenceSnapshot | null {
  return snapshots.get(key(organizationId)) ?? null;
}

export function listSnapshotHistory(
  organizationId: string,
  limit = 50,
): MarketingIntelligenceHistoryEntry[] {
  return history.filter((h) => h.organizationId === organizationId).slice(-limit);
}

export function clearSnapshots(): void {
  snapshots.clear();
  history.length = 0;
}
