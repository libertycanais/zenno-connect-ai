// EPIC J — Product Layer · Shared contracts
// 100% additive. Organization-scoped. No I/O. No provider access.

export type ProductPriority = 1 | 2 | 3 | 4 | 5; // 1 = highest
export type ProductSeverity = "info" | "warn" | "critical";
export type ProductDomain =
  | "marketing" | "financial" | "commercial" | "seo"
  | "growth" | "operations" | "executive" | "tracking" | "ai";

export type OrgScoped = { organizationId: string };

// -------------------- Action --------------------
export type ActionStatus =
  | "suggested" | "pending_approval" | "approved" | "rejected"
  | "scheduled" | "in_progress" | "executed" | "failed" | "cancelled";

export type ActionRisk = "low" | "medium" | "high";

export type ProductAction = OrgScoped & {
  id: string;
  title: string;
  description: string;
  priority: ProductPriority;
  impact: ProductSeverity;
  estimatedGainCents: number;
  estimatedCostCents: number;
  risk: ActionRisk;
  confidence: number;            // 0..1
  requiredPermissions: string[]; // e.g. ["owner","admin"]
  status: ActionStatus;
  sourceRecommendation?: string; // recommendation id
  domain: ProductDomain;
  approvedBy?: string;
  approvedAt?: string;
  executedAt?: string;
  scheduledFor?: string;
  createdAt: string;
  updatedAt: string;
};

// -------------------- Recommendation view --------------------
export type ProductRecommendation = OrgScoped & {
  id: string;
  domain: ProductDomain;
  title: string;
  summary: string;
  origin: string;                 // expertId or "system"
  evidenceIds: string[];
  playbookIds: string[];
  impactCents: number;
  confidence: number;             // 0..1
  createdAt: string;
};

// -------------------- Insight Feed --------------------
export type InsightKind =
  | "signal" | "executive_report" | "learning_event"
  | "business_memory" | "playbook" | "forecast" | "consensus";

export type InsightItem = OrgScoped & {
  id: string;
  kind: InsightKind;
  title: string;
  summary: string;
  severity: ProductSeverity;
  refs: string[];
  domain: ProductDomain;
  occurredAt: string;
};

// -------------------- Notifications --------------------
export type NotificationChannel = "in_app" | "email" | "webhook" | "push" | "whatsapp" | "discord" | "slack";

export type NotificationRequest = OrgScoped & {
  id: string;
  channel: NotificationChannel;
  title: string;
  body: string;
  severity: ProductSeverity;
  audience: string[];      // user ids (or role tags)
  refs: string[];
  createdAt: string;
};

export type NotificationDispatchResult = {
  notificationId: string;
  channel: NotificationChannel;
  status: "queued" | "sent" | "failed" | "skipped";
  reason?: string;
  attemptedAt: string;
};

export interface NotificationTransport {
  readonly channel: NotificationChannel;
  send(n: NotificationRequest): Promise<NotificationDispatchResult>;
}

// -------------------- Widgets & Dashboard --------------------
export type WidgetType =
  | "executive_score" | "kpis" | "forecast" | "timeline"
  | "signals" | "insights" | "recommendations" | "memory" | "experts";

export type WidgetSize = "sm" | "md" | "lg" | "xl";

export type WidgetDescriptor = {
  id: string;
  type: WidgetType;
  title: string;
  size: WidgetSize;
  position: number;
  props?: Record<string, unknown>;
};

export type DashboardLayout = OrgScoped & {
  id: string;
  name: string;
  widgets: WidgetDescriptor[];
  updatedAt: string;
};

// -------------------- Preferences / Bookmarks / Filters --------------------
export type UserPreferences = OrgScoped & {
  userId: string;
  theme?: "light" | "dark" | "system";
  density?: "cozy" | "compact";
  defaultDashboardId?: string;
  pinnedDomains?: ProductDomain[];
  updatedAt: string;
};

export type Bookmark = OrgScoped & {
  id: string;
  userId: string;
  refKind: "recommendation" | "playbook" | "report" | "insight" | "action";
  refId: string;
  note?: string;
  createdAt: string;
};

export type FeedFilter = {
  domains?: ProductDomain[];
  severities?: ProductSeverity[];
  kinds?: InsightKind[];
  since?: string;
  until?: string;
  search?: string;
};
