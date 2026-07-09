// Feature P0.2 — Customer Portal
// Helpers puros usados pelo Portal do Cliente. Sem I/O; totalmente testáveis.
// Aditivo sobre baseline v1.0: não altera contratos existentes.

import type { PlanRow } from "@/lib/plans.functions";

export type SubscriptionLike = {
  id?: string | null;
  plan?: string | null;
  status?: string | null;
  trial_ends_at?: string | null;
  current_period_end?: string | null;
  cancel_at_period_end?: boolean | null;
  canceled_at?: string | null;
  price_cents?: number | null;
};

export type SubscriptionEventLike = {
  id: string;
  event_type: string;
  from_plan_code: string | null;
  to_plan_code: string | null;
  provider: string | null;
  created_at: string;
  metadata?: Record<string, unknown> | null;
};

export function formatCurrencyCents(cents: number, currency = "BRL"): string {
  const value = (cents ?? 0) / 100;
  try {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency,
    }).format(value);
  } catch {
    return `${currency} ${value.toFixed(2)}`;
  }
}

export function daysUntil(iso: string | null | undefined, now: number = Date.now()): number {
  if (!iso) return 0;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return 0;
  return Math.max(0, Math.ceil((t - now) / (24 * 3600 * 1000)));
}

export function computeTrialInfo(
  sub: SubscriptionLike | null | undefined,
  now: number = Date.now(),
): { inTrial: boolean; daysLeft: number; endsAt: string | null } {
  if (!sub) return { inTrial: false, daysLeft: 0, endsAt: null };
  const inTrial =
    sub.status === "trialing" || (sub.plan ?? "").toLowerCase() === "trial";
  return {
    inTrial,
    daysLeft: daysUntil(sub.trial_ends_at, now),
    endsAt: sub.trial_ends_at ?? null,
  };
}

export function computeRenewalInfo(
  sub: SubscriptionLike | null | undefined,
  now: number = Date.now(),
): { nextChargeAt: string | null; daysLeft: number; willRenew: boolean } {
  if (!sub || !sub.current_period_end) {
    return { nextChargeAt: null, daysLeft: 0, willRenew: false };
  }
  return {
    nextChargeAt: sub.current_period_end,
    daysLeft: daysUntil(sub.current_period_end, now),
    willRenew: !sub.cancel_at_period_end && sub.status === "active",
  };
}

export function isActive(sub: SubscriptionLike | null | undefined): boolean {
  const s = (sub?.status ?? "").toLowerCase();
  return s === "active" || s === "trialing";
}

export function canCancel(sub: SubscriptionLike | null | undefined): boolean {
  if (!sub) return false;
  const s = (sub.status ?? "").toLowerCase();
  const p = (sub.plan ?? "").toLowerCase();
  if (s === "cancelled" || s === "canceled") return false;
  if (p === "cancelado" || p === "trial") return false;
  return isActive(sub) && !sub.cancel_at_period_end;
}

export function findCurrentPlan(
  plans: readonly PlanRow[],
  sub: SubscriptionLike | null | undefined,
): PlanRow | undefined {
  if (!sub?.plan) return undefined;
  return plans.find((p) => p.code === sub.plan);
}

export function extractLimits(plan: PlanRow | undefined): Array<{ key: string; value: string }> {
  if (!plan?.limits) return [];
  return Object.entries(plan.limits).map(([key, value]) => ({
    key,
    value: value === null ? "—" : String(value),
  }));
}

export function extractFeatureList(plan: PlanRow | undefined): string[] {
  if (!plan?.features) return [];
  const out: string[] = [];
  for (const [key, value] of Object.entries(plan.features)) {
    if (typeof value === "boolean" && value) out.push(prettifyKey(key));
    else if (typeof value === "string") out.push(`${prettifyKey(key)}: ${value}`);
    else if (typeof value === "number") out.push(`${prettifyKey(key)}: ${value}`);
  }
  return out;
}

function prettifyKey(k: string): string {
  return k
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

const EVENT_LABELS: Record<string, string> = {
  created: "Assinatura criada",
  activated: "Ativação",
  upgraded: "Upgrade de plano",
  downgraded: "Downgrade de plano",
  canceled: "Cancelamento",
  cancelled: "Cancelamento",
  checkout_started: "Checkout iniciado",
  payment_succeeded: "Pagamento confirmado",
  payment_failed: "Falha no pagamento",
  renewed: "Renovação",
  reactivated: "Reativação",
};

export function labelForEvent(type: string): string {
  return EVENT_LABELS[type] ?? prettifyKey(type);
}

export type EventTone = "positive" | "negative" | "neutral" | "warning";
export function toneForEvent(type: string): EventTone {
  switch (type) {
    case "activated":
    case "upgraded":
    case "payment_succeeded":
    case "renewed":
    case "reactivated":
    case "created":
      return "positive";
    case "canceled":
    case "cancelled":
    case "payment_failed":
      return "negative";
    case "downgraded":
      return "warning";
    default:
      return "neutral";
  }
}
