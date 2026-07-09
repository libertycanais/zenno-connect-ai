// FEATURE P0.6 — Onda 2 · Reader interfaces
// The Context Engine NEVER touches the database directly. Each slice module
// receives a typed `reader` function. This keeps modules pure/testable and
// leaves data access to server-scoped code that respects RLS.

import type {
  AdsSlice,
  AnalyticsSlice,
  BillingSlice,
  ConversationSlice,
  CrmSlice,
  ExecutiveSlice,
  FinanceSlice,
  MemorySlice,
  OrganizationSlice,
  TeamSlice,
  TrackingSlice,
  WhatsAppSlice,
} from "./types";

export type ReaderScope = { organizationId: string; userId: string };

export type ContextReaders = {
  organization: (s: ReaderScope) => Promise<OrganizationSlice | null>;
  team: (s: ReaderScope) => Promise<TeamSlice | null>;
  billing: (s: ReaderScope) => Promise<BillingSlice | null>;
  tracking: (s: ReaderScope) => Promise<TrackingSlice | null>;
  ads: (s: ReaderScope) => Promise<AdsSlice | null>;
  crm: (s: ReaderScope) => Promise<CrmSlice | null>;
  analytics: (s: ReaderScope) => Promise<AnalyticsSlice | null>;
  finance: (s: ReaderScope) => Promise<FinanceSlice | null>;
  executive: (s: ReaderScope) => Promise<ExecutiveSlice | null>;
  whatsapp: (s: ReaderScope) => Promise<WhatsAppSlice | null>;
  memory: (s: ReaderScope) => Promise<MemorySlice | null>;
  conversation: (
    s: ReaderScope & { conversationId?: string | null },
  ) => Promise<ConversationSlice | null>;
};

/** Null readers — safe default used when no data source is wired yet. */
export const nullReaders: ContextReaders = {
  organization: async () => null,
  team: async () => null,
  billing: async () => null,
  tracking: async () => null,
  ads: async () => null,
  crm: async () => null,
  analytics: async () => null,
  finance: async () => null,
  executive: async () => null,
  whatsapp: async () => null,
  memory: async () => null,
  conversation: async () => null,
};
