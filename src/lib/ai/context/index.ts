// FEATURE P0.6 — Onda 2 · Context Engine barrel
// Public surface. The Orchestrator/Prompt Builder import from here only.

export * from "./types";
export * from "./readers";
export * from "./cache";
export * from "./token-budget";
export * from "./context-assembler";
export { loadOrganizationContext } from "./organization-context";
export { loadTeamContext } from "./team-context";
export { loadBillingContext } from "./billing-context";
export { loadTrackingContext } from "./tracking-context";
export { loadAdsContext } from "./ads-context";
export { loadCrmContext } from "./crm-context";
export { loadAnalyticsContext } from "./analytics-context";
export { loadFinanceContext } from "./finance-context";
export { loadExecutiveContext } from "./executive-context";
export { loadWhatsAppContext } from "./whatsapp-context";
export { loadMemoryContext, mergeMemorySlices } from "./memory-context";
export { loadConversationContext, trimConversation } from "./conversation-context";

import { assembleBusinessContext, type AssembleContextDeps, type AssembleContextInput } from "./context-assembler";
import { reduceContext } from "./token-budget";
import { buildUserPromptFromContext } from "./prompt-bridge";
import type { BusinessContext } from "./types";

/**
 * Legacy compatibility shim expected by Orchestrator/Onda 1.
 * Prefer `assembleBusinessContext` directly in new code.
 */
export type ContextScope = AssembleContextInput & { lookbackDays?: number };
export type ContextBundle = {
  memory: Array<{ scope: string; key: string; value: unknown }>;
  facts: Array<{ label: string; content: string }>;
  cacheHit: boolean;
  business?: BusinessContext;
};

export async function assembleContext(
  scope: ContextScope,
  deps?: AssembleContextDeps,
): Promise<ContextBundle> {
  if (!deps) return { memory: [], facts: [], cacheHit: false };
  const business = await assembleBusinessContext(scope, deps);
  const mem = business.memory.data;
  const memory = mem
    ? [
        ...mem.objectives.map((e) => ({ scope: "objectives", key: e.key, value: e.value })),
        ...mem.preferences.map((e) => ({ scope: "preferences", key: e.key, value: e.value })),
        ...mem.restrictions.map((e) => ({ scope: "restrictions", key: e.key, value: e.value })),
        ...mem.insights.map((e) => ({ scope: "insights", key: e.key, value: e.value })),
      ]
    : [];
  return { memory, facts: [], cacheHit: false, business };
}

export { buildUserPromptFromContext, reduceContext };
