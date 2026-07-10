// FEATURE — Marketing Intelligence · Types (additive, pure)
// Architecture Freeze v1.0 preserved. No dependency on Provider Layer.

import type { MarketingProvider } from "../../contracts/assets";

export type IntelligenceSeverity = "excellent" | "good" | "attention" | "critical";

export type HealthDimension =
  | "campaign" | "budget" | "conversion" | "tracking" | "keyword";

export type HealthComponent = {
  dimension: HealthDimension;
  score: number;            // 0..100
  severity: IntelligenceSeverity;
  reasons: string[];
};

export type MarketingHealthReport = {
  overall: number;          // 0..100
  severity: IntelligenceSeverity;
  components: HealthComponent[];
  computedAt: string;
};

export type AIReadinessComponent = {
  key: "google_ads" | "analytics" | "search_console" | "tag_manager" | "conversions" | "offline_conversions";
  score: number;            // 0..100
  ready: boolean;
  gap?: string;
};

export type AIReadinessReport = {
  overall: number;
  components: AIReadinessComponent[];
  computedAt: string;
};

export type IntelligenceRecommendation = {
  id: string;
  organizationId: string;
  provider: MarketingProvider;
  problem: string;
  cause: string;
  impact: string;
  priority: "low" | "medium" | "high" | "critical";
  financialValueCents: number;
  recommendation: string;
  nextAction: string;
  confidence: number;       // 0..1
  sources: string[];
  createdAt: string;
};

export type ExecutiveSummary = {
  organizationId: string;
  provider: MarketingProvider;
  summary: string;
  healthScore: number;
  topOpportunity: string | null;
  topRisk: string | null;
  estimatedRoiCents: number;
  financialImpactCents: number;
  priority: IntelligenceRecommendation["priority"];
  nextSteps: string[];
  confidence: number;
  sources: string[];
  generatedAt: string;
};

export type IntelligenceMetrics = {
  totalMs: number;
  contextMs: number;
  expertsMs: number;
  executiveMs: number;
  recommendationsCount: number;
  campaignsAnalyzed: number;
  tokensUsed: number;
  estimatedCostCents: number;
  healthScore: number;
  aiReadiness: number;
};

export type PipelineInput = {
  organizationId: string;
  provider: MarketingProvider;
  connectionId: string;
  campaigns?: CampaignFacts[];
  tracking?: TrackingFacts;
};

export type CampaignFacts = {
  id: string;
  name: string;
  status: "enabled" | "paused" | "removed";
  spendCents: number;
  conversions: number;
  clicks: number;
  impressions: number;
  revenueCents: number;
  ctr?: number;
  cpaCents?: number;
  roas?: number;
};

export type TrackingFacts = {
  coverage: number;         // 0..1
  conversionsConfigured: boolean;
  offlineConversions: boolean;
  ga4Linked: boolean;
  gscLinked: boolean;
  gtmPresent: boolean;
};

export type PipelineResult = {
  organizationId: string;
  provider: MarketingProvider;
  connectionId: string;
  health: MarketingHealthReport;
  aiReadiness: AIReadinessReport;
  recommendations: IntelligenceRecommendation[];
  executive: ExecutiveSummary;
  metrics: IntelligenceMetrics;
  timelineEventIds: string[];
  completedAt: string;
};
