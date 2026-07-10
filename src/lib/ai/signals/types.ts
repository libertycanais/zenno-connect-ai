// EPIC G — Business Signals · Contracts (100% additive, no I/O, no provider access)
export type SignalSeverity = "info" | "low" | "medium" | "high" | "critical";
export type SignalStatus = "open" | "acknowledged" | "resolved" | "suppressed" | "expired";
export type SignalDomain =
  | "marketing" | "seo" | "crm" | "sales" | "finance" | "executive" | "tracking" | "product";

export type SignalType =
  // Marketing
  | "CampaignStarted" | "CampaignStopped" | "CampaignPaused" | "BudgetLimited"
  | "CTRDrop" | "CPAIncrease" | "ROASDrop" | "ConversionDrop"
  | "TrackingLost" | "PixelInactive" | "AudienceFatigue" | "CreativeFatigue"
  // SEO
  | "OrganicTrafficDrop" | "KeywordLoss" | "IndexationIssue" | "PerformanceIssue"
  // CRM
  | "LeadDrop" | "LeadGrowth" | "PipelineStopped"
  // Sales
  | "RevenueDrop" | "RevenueGrowth" | "MRRDrop" | "ChurnIncrease"
  // Finance
  | "CostIncrease" | "MarginDrop" | "CashFlowRisk"
  // Executive
  | "BusinessHealthDrop" | "CriticalRisk" | "HighOpportunity";

export type SignalSource = {
  origin: "kpi" | "event" | "expert" | "monitor" | "trend" | "anomaly" | "correlation" | "manual";
  ref?: string;                   // e.g. kpi id, event id
  detectorId?: string;            // registry id of detector
};

export type SignalEvidenceItem = {
  kind: "kpi" | "metric" | "event" | "note";
  key: string;
  value: number | string | null;
  baseline?: number | null;
  delta?: number | null;
  window?: string;                // e.g. "7d"
};

export type SignalRecommendedExpert = "marketing" | "sales" | "finance" | "executive" | "seo" | "growth" | "cro" | "crm" | "customer-success";

export type BusinessSignal = {
  id: string;
  organizationId: string;
  type: SignalType;
  domain: SignalDomain;
  severity: SignalSeverity;
  score: number;                  // 0..100
  priority: number;               // 1 (highest) .. 5 (lowest)
  confidence: number;             // 0..1
  createdAt: string;              // ISO
  source: SignalSource;
  evidence: SignalEvidenceItem[];
  recommendedExperts: SignalRecommendedExpert[];
  playbookHint?: string;
  status: SignalStatus;
  dedupeKey: string;              // stable hash for cooldown/dedup
  metadata?: Record<string, unknown>;
};

export type SignalDetectorInput = {
  organizationId: string;
  now?: Date;
  kpis?: Record<string, number | null>;   // named KPIs
  baseline?: Record<string, number | null>;
  events?: Array<{ type: string; at: string; payload?: Record<string, unknown> }>;
  context?: Record<string, unknown>;
};

export type SignalDetector = {
  id: string;
  type: SignalType;
  domain: SignalDomain;
  cadence: "hourly" | "daily" | "weekly" | "monthly" | "on-event";
  detect(input: SignalDetectorInput): Omit<BusinessSignal, "id" | "createdAt" | "status" | "dedupeKey"> | null;
};
