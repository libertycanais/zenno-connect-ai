// FEATURE P0.6 — Onda 1 · AI Policy Engine
// Enforced before every provider call. No feature bypasses this.
// Rules: plan, org status, budget (soft/hard), rate limit, provider/model allow-list,
// feature flag. Returns a structured decision — never throws upstream.

import type { AIProviderName, PolicyDecision } from "../types";

export type OrgSubscriptionSnapshot = {
  status: "active" | "trialing" | "past_due" | "canceled" | "suspended" | null;
  plan: string | null;
  ai_enabled: boolean;
  monthly_budget_cents: number;
  monthly_spent_cents: number;
  daily_spent_cents: number;
  daily_budget_cents: number;
  allowed_providers: readonly AIProviderName[];
  allowed_models: readonly string[] | null; // null = no restriction
};

export type RateLimitSnapshot = {
  user_messages_last_minute: number;
  org_messages_last_minute: number;
  user_limit_per_minute: number;
  org_limit_per_minute: number;
};

export type PolicyInput = {
  organizationId: string;
  userId: string;
  provider: AIProviderName;
  model: string;
  estimatedCostCents: number;
  featureFlagEnabled?: boolean;
  subscription: OrgSubscriptionSnapshot;
  rateLimit: RateLimitSnapshot;
};

/**
 * Pure decision function. Deterministic — easy to unit-test with fixtures.
 */
export function evaluatePolicy(input: PolicyInput): PolicyDecision {
  const {
    subscription: sub,
    rateLimit: rl,
    provider,
    model,
    estimatedCostCents,
    featureFlagEnabled,
  } = input;

  if (featureFlagEnabled === false) {
    return deny("FEATURE_FLAG_DISABLED", "IA temporariamente desabilitada.");
  }
  if (!sub.status || sub.status === "canceled" || sub.status === "suspended") {
    return deny("SUBSCRIPTION_INACTIVE", "Assinatura inativa. Ative para usar o Copiloto.");
  }
  if (!sub.ai_enabled) {
    return deny("PLAN_FEATURE_DISABLED", "Seu plano não inclui o Zenno AI Copilot.");
  }
  if (!sub.allowed_providers.includes(provider)) {
    return deny("PROVIDER_NOT_ALLOWED", `Provedor ${provider} não permitido no plano atual.`);
  }
  if (sub.allowed_models && !sub.allowed_models.includes(model)) {
    return deny("MODEL_NOT_ALLOWED", `Modelo ${model} não permitido no plano atual.`);
  }

  // Hard budget: current + estimated > cap → block
  if (
    sub.monthly_budget_cents > 0 &&
    sub.monthly_spent_cents + estimatedCostCents > sub.monthly_budget_cents
  ) {
    return {
      allowed: false,
      error: {
        code: "BUDGET_EXCEEDED",
        retryable: false,
        userMessage: "Orçamento mensal de IA atingido.",
        subCode: "BUDGET_EXCEEDED_MONTHLY",
      },
    };
  }
  if (
    sub.daily_budget_cents > 0 &&
    sub.daily_spent_cents + estimatedCostCents > sub.daily_budget_cents
  ) {
    return {
      allowed: false,
      error: {
        code: "BUDGET_EXCEEDED",
        retryable: false,
        userMessage: "Orçamento diário de IA atingido.",
        subCode: "BUDGET_EXCEEDED_DAILY",
      },
    };
  }

  if (rl.user_messages_last_minute >= rl.user_limit_per_minute) {
    return {
      allowed: false,
      error: {
        code: "RATE_LIMITED",
        retryable: true,
        userMessage: "Você atingiu o limite de mensagens por minuto.",
        subCode: "RATE_LIMIT_USER",
      },
    };
  }
  if (rl.org_messages_last_minute >= rl.org_limit_per_minute) {
    return {
      allowed: false,
      error: {
        code: "RATE_LIMITED",
        retryable: true,
        userMessage: "Sua organização atingiu o limite de mensagens por minuto.",
        subCode: "RATE_LIMIT_ORG",
      },
    };
  }
  return { allowed: true };
}

function deny(subCode: string, userMessage: string): PolicyDecision {
  return {
    allowed: false,
    error: { code: "POLICY_BLOCKED", retryable: false, userMessage, subCode },
  };
}

/** Default caps used when Policy Engine snapshot builder can't reach billing. */
export const DEFAULT_POLICY_CAPS = {
  monthly_budget_cents: 50_000, // $500
  daily_budget_cents: 5_000, // $50
  user_limit_per_minute: 20,
  org_limit_per_minute: 120,
} as const;
