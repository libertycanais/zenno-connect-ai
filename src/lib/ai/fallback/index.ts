// EPIC B — AI Execution Platform · Provider Fallback Policy
// Given the primary route + candidate fallbacks, picks the next healthy
// provider when the primary trips a breaker or fails. Pure function; the
// decision is recorded in the Decision Trace by the Executor.

import type { AIProviderName } from "../types";
import type { CapabilityMatch } from "../contracts/capability";
import { providerHealth } from "../health";
import { circuitBreaker, breakerKey } from "../resilience";

export type FallbackDecision = {
  used: boolean;
  from: { provider: AIProviderName; model: string } | null;
  to: { provider: AIProviderName; model: string } | null;
  reasonCode: string;
  reason: string;
};

export function pickFallback(
  primary: { provider: AIProviderName; model: string },
  candidates: CapabilityMatch[],
): FallbackDecision {
  for (const c of candidates) {
    if (c.provider === primary.provider && c.model === primary.model) continue;
    const snap = providerHealth.snapshot(c.provider);
    if (snap.status === "offline") continue;
    if (circuitBreaker.isOpen(breakerKey(c.provider, c.model))) continue;
    return {
      used: true, from: primary,
      to: { provider: c.provider, model: c.model },
      reasonCode: "provider_fallback",
      reason: `Fallback to ${c.provider}:${c.model} (primary=${primary.provider}:${primary.model})`,
    };
  }
  return {
    used: false, from: primary, to: null,
    reasonCode: "no_fallback_available",
    reason: "Nenhum provider fallback saudável",
  };
}
