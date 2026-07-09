// FEATURE P0.6 — Onda 2 · Business Intelligence Context Engine
// Strongly-typed BusinessContext. NO free text — every field is structured.
// This is the ONLY input the Prompt Builder accepts (besides UserPrompt).

import type { AIAgent } from "../types";

/** Provenance for every context slice. Provider uses this to weigh answers. */
export type ContextMeta = {
  source: string;
  generatedAt: string;
  ttlSeconds: number;
  freshness: "fresh" | "stale" | "missing";
  confidence: number; // 0..1
};

export type WithMeta<T> = { data: T | null; meta: ContextMeta };

// ── Domain slices ───────────────────────────────────────────────────────────
export type OrganizationSlice = {
  id: string;
  name: string;
  locale: string;
  timezone: string;
  currency: string;
  industry: string | null;
  productLines: string[];
};

export type TeamSlice = {
  totalMembers: number;
  activeMembers: number;
  pendingInvitations: number;
  roles: Record<string, number>;
  currentUserRole: string;
};

export type BillingSlice = {
  plan: string;
  status: string;
  trialEndsAt: string | null;
  renewalAt: string | null;
  mrrCents: number;
  arrCents: number;
  limits: Record<string, number | null>;
  usage: Record<string, number | null>;
};

export type TrackingSlice = {
  windowDays: number;
  totalEvents: number;
  totalSessions: number;
  totalConversions: number;
  topUtmSources: Array<{ source: string; count: number }>;
  topUtmCampaigns: Array<{ campaign: string; count: number }>;
};

export type AdsSlice = {
  meta: { activeCampaigns: number; spendCents: number; conversions: number; roas: number | null };
  google: { activeCampaigns: number; spendCents: number; conversions: number; roas: number | null };
};

export type CrmSlice = {
  totalLeads: number;
  newLeads7d: number;
  pipeline: Array<{ status: string; count: number; valueCents: number }>;
  hotLeads: number;
};

export type AnalyticsSlice = {
  windowDays: number;
  visitors: number;
  sessions: number;
  bounceRate: number | null;
  topPages: Array<{ path: string; visits: number }>;
};

export type FinanceSlice = {
  revenueCents30d: number;
  expensesCents30d: number;
  netCents30d: number;
  overdueChargesCents: number;
};

export type ExecutiveSlice = {
  mrrCents: number;
  arrCents: number;
  activeCustomers: number;
  churnRate: number | null;
  conversionRate: number | null;
  cacCents: number | null;
  ltvCents: number | null;
  roi: number | null;
};

export type WhatsAppSlice = {
  activeInstances: number;
  openChats: number;
  messages24h: number;
};

export type MemorySlice = {
  objectives: Array<{ key: string; value: unknown }>;
  preferences: Array<{ key: string; value: unknown }>;
  restrictions: Array<{ key: string; value: unknown }>;
  insights: Array<{ key: string; value: unknown }>;
};

export type ConversationSlice = {
  conversationId: string | null;
  turnCount: number;
  recentTurns: Array<{ role: "user" | "assistant"; content: string; at: string }>;
};

// ── Root ────────────────────────────────────────────────────────────────────
export type BusinessContext = {
  scope: {
    organizationId: string;
    userId: string;
    agent: AIAgent;
    generatedAt: string;
  };
  organization: WithMeta<OrganizationSlice>;
  team: WithMeta<TeamSlice>;
  billing: WithMeta<BillingSlice>;
  tracking: WithMeta<TrackingSlice>;
  ads: WithMeta<AdsSlice>;
  crm: WithMeta<CrmSlice>;
  analytics: WithMeta<AnalyticsSlice>;
  finance: WithMeta<FinanceSlice>;
  executive: WithMeta<ExecutiveSlice>;
  whatsapp: WithMeta<WhatsAppSlice>;
  memory: WithMeta<MemorySlice>;
  conversation: WithMeta<ConversationSlice>;
};

/** TTL (seconds) per module — Wave 2 spec. */
export const CONTEXT_TTL = {
  organization: 24 * 60 * 60,
  team: 10 * 60,
  billing: 5 * 60,
  tracking: 2 * 60,
  ads: 5 * 60,
  crm: 5 * 60,
  analytics: 5 * 60,
  finance: 5 * 60,
  executive: 60,
  whatsapp: 2 * 60,
  memory: 30 * 60,
  conversation: 30,
} as const satisfies Record<keyof Omit<BusinessContext, "scope">, number>;

export type ContextModuleName = keyof typeof CONTEXT_TTL;
