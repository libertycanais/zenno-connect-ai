// EPIC I — Executive Decision Platform · Contracts
// 100% additive. No mutation of prior layers. Organization-scoped.

import type { ExpertId, ExpertRunOutput } from "../experts/types";
import type { ConsensusResult } from "../consensus";

export type ExecutiveSeverity = "info" | "warn" | "critical";
export type ExecutivePriority = 1 | 2 | 3 | 4 | 5; // 1 = highest

export type ExecutiveKpiSnapshot = {
  kpi: string;
  label: string;
  value: number | null;
  unit: string;
  severity: ExecutiveSeverity;
  delta?: number | null; // pct change vs baseline
};

export type ExecutiveRisk = {
  id: string;
  title: string;
  severity: ExecutiveSeverity;
  likelihood: number; // 0..1
  impactCents: number; // negative = loss
  category: "financial" | "operational" | "market" | "compliance" | "data" | "ai";
  evidence: string[]; // signal / kpi / rule ids
};

export type ExecutiveOpportunity = {
  id: string;
  title: string;
  upsideCents: number; // positive = revenue lift
  effort: "low" | "medium" | "high";
  confidence: number; // 0..1
  evidence: string[];
};

export type ExecutivePriorityItem = {
  id: string;
  title: string;
  priority: ExecutivePriority;
  rationale: string;
  linkedRecommendationIds: string[];
  linkedPlaybookIds: string[];
  impactCents: number;
  confidence: number;
};

export type ExecutiveNextAction = {
  id: string;
  title: string;
  owner: ExpertId | "cto" | "ceo" | "ops";
  dueInDays: number;
  effort: "low" | "medium" | "high";
};

export type ExecutiveProjection = {
  horizonDays: number;
  metric: string;
  baseline: number | null;
  projected: number | null;
  confidence: number; // 0..1
  method: "naive" | "trend" | "expert";
};

export type ExecutiveScoreDimension = {
  name: string;
  weight: number; // 0..1
  score: number;  // 0..100
  reason?: string;
};

export type ExecutiveScore = {
  overall: number; // 0..100
  dimensions: ExecutiveScoreDimension[];
  generatedAt: string;
};

export type ExecutiveExplainability = {
  sources: string[];
  expertsInvolved: ExpertId[];
  memoryRefs: string[];
  ruleRefs: string[];
  confidence: number; // 0..1
};

export type ExecutiveReport = {
  reportId: string;
  organizationId: string;
  generatedAt: string;
  version: number;
  summary: string;                      // Resumo Executivo
  situation: string;                    // Situação Atual
  criticalKpis: ExecutiveKpiSnapshot[]; // KPIs Críticos
  risks: ExecutiveRisk[];
  opportunities: ExecutiveOpportunity[];
  financialImpactCents: number;         // net (upside - risk exposure)
  priorities: ExecutivePriorityItem[];
  linkedPlaybookIds: string[];
  nextActions: ExecutiveNextAction[];
  projections: ExecutiveProjection[];
  score: ExecutiveScore;
  consensus: ConsensusResult | null;
  confidence: number;
  explainability: ExecutiveExplainability;
  narrative: string; // Executive brief (natural language, deterministic)
};

export type ExecutiveEngineInput = {
  organizationId: string;
  topic: string;
  kpis: ExecutiveKpiSnapshot[];
  expertOutputs: ExpertRunOutput[];
  signals?: Array<{ id: string; title: string; severity: ExecutiveSeverity; impactCents?: number }>;
  memoryRefs?: string[];
  ruleRefs?: string[];
  dnaSummary?: string;
  horizonDays?: number;
};
