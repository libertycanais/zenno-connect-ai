// FEATURE — Marketing Intelligence Experience · Canonical events (additive)
// Architecture Freeze v1.0 preserved. Pure types + typed bus payloads.
import type { MarketingProvider } from "../../contracts/assets";
import type {
  MarketingHealthReport,
  AIReadinessReport,
  IntelligenceRecommendation,
  ExecutiveSummary,
  PipelineResult,
} from "../types";

export type MarketingEventName =
  | "MarketingPlatformConnected"
  | "MarketingSyncStarted"
  | "MarketingSyncCompleted"
  | "MarketingHealthUpdated"
  | "MarketingRecommendationsGenerated"
  | "ExecutiveSummaryGenerated"
  | "MarketingContextUpdated"
  | "MarketingIntelligenceSnapshotUpdated";

export type MarketingEventBase = {
  organizationId: string;
  provider: MarketingProvider;
  connectionId?: string;
  at: string;
};

export type MarketingEventMap = {
  MarketingPlatformConnected: MarketingEventBase;
  MarketingSyncStarted: MarketingEventBase;
  MarketingSyncCompleted: MarketingEventBase & { pipeline?: PipelineResult };
  MarketingHealthUpdated: MarketingEventBase & { health: MarketingHealthReport; readiness: AIReadinessReport };
  MarketingRecommendationsGenerated: MarketingEventBase & { recommendations: IntelligenceRecommendation[] };
  ExecutiveSummaryGenerated: MarketingEventBase & { executive: ExecutiveSummary };
  MarketingContextUpdated: MarketingEventBase;
  MarketingIntelligenceSnapshotUpdated: MarketingEventBase & { score: number };
};

export type MarketingEvent<K extends MarketingEventName = MarketingEventName> = {
  name: K;
} & MarketingEventMap[K];
