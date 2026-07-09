// FEATURE P0.6 — Onda 2 · Context Assembler
// SOLE producer of BusinessContext. Runs all slice loaders in parallel using
// the injected readers + cache. Never touches the database itself.

import type { AIAgent } from "../types";
import { loadAdsContext } from "./ads-context";
import { loadAnalyticsContext } from "./analytics-context";
import { loadBillingContext } from "./billing-context";
import type { ContextCache } from "./cache";
import { loadConversationContext } from "./conversation-context";
import { loadCrmContext } from "./crm-context";
import { loadExecutiveContext } from "./executive-context";
import { loadFinanceContext } from "./finance-context";
import { loadMemoryContext } from "./memory-context";
import { loadOrganizationContext } from "./organization-context";
import type { ContextReaders } from "./readers";
import { loadTeamContext } from "./team-context";
import { loadTrackingContext } from "./tracking-context";
import { loadWhatsAppContext } from "./whatsapp-context";
import type { BusinessContext } from "./types";

export type AssembleContextInput = {
  organizationId: string;
  userId: string;
  agent: AIAgent;
  conversationId?: string | null;
};

export type AssembleContextDeps = {
  readers: ContextReaders;
  cache: ContextCache;
  now?: () => Date;
};

export async function assembleBusinessContext(
  input: AssembleContextInput,
  deps: AssembleContextDeps,
): Promise<BusinessContext> {
  if (!input.organizationId || !input.userId) {
    throw new Error("assembleBusinessContext: organizationId and userId are required");
  }
  const runnerDeps = { cache: deps.cache, now: deps.now };
  const { organizationId, userId } = input;

  const [
    organization,
    team,
    billing,
    tracking,
    ads,
    crm,
    analytics,
    finance,
    executive,
    whatsapp,
    memory,
    conversation,
  ] = await Promise.all([
    loadOrganizationContext(organizationId, userId, deps.readers, runnerDeps),
    loadTeamContext(organizationId, userId, deps.readers, runnerDeps),
    loadBillingContext(organizationId, userId, deps.readers, runnerDeps),
    loadTrackingContext(organizationId, userId, deps.readers, runnerDeps),
    loadAdsContext(organizationId, userId, deps.readers, runnerDeps),
    loadCrmContext(organizationId, userId, deps.readers, runnerDeps),
    loadAnalyticsContext(organizationId, userId, deps.readers, runnerDeps),
    loadFinanceContext(organizationId, userId, deps.readers, runnerDeps),
    loadExecutiveContext(organizationId, userId, deps.readers, runnerDeps),
    loadWhatsAppContext(organizationId, userId, deps.readers, runnerDeps),
    loadMemoryContext(organizationId, userId, deps.readers, runnerDeps),
    loadConversationContext(organizationId, userId, deps.readers, runnerDeps, input.conversationId),
  ]);

  const now = deps.now ?? (() => new Date());
  return {
    scope: {
      organizationId,
      userId,
      agent: input.agent,
      generatedAt: now().toISOString(),
    },
    organization,
    team,
    billing,
    tracking,
    ads,
    crm,
    analytics,
    finance,
    executive,
    whatsapp,
    memory,
    conversation,
  };
}
