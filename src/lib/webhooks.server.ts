// Feature P0.3 — Processador de webhooks de pagamento.
// Server-only. Idempotência via tabela `webhook_events` (UNIQUE provider,event_id).
// Aplica atualizações em `subscriptions` + `subscription_events` e grava audit_log.

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { log } from "@/lib/logger";
import type {
  NormalizedWebhookEvent,
  NormalizedWebhookEventType,
} from "@/providers/payments/webhook-events.types";

type Admin = typeof supabaseAdmin & { rpc: (fn: string, args: Record<string, unknown>) => Promise<unknown> };

/** Resultado do processamento de um webhook individual. */
export type ProcessResult = {
  status: "processed" | "duplicate" | "skipped" | "failed";
  organizationId?: string;
  subscriptionId?: string;
  eventType: NormalizedWebhookEventType;
  message?: string;
};

/**
 * Resolve `organization_id` para o evento. Preferência:
 * 1. `event.organizationId` (metadata do checkout).
 * 2. Assinatura existente com `provider_subscription_id`.
 * 3. Assinatura existente com `provider_customer_id`.
 */
export async function resolveOrganizationId(
  ev: NormalizedWebhookEvent,
): Promise<string | undefined> {
  if (ev.organizationId) return ev.organizationId;
  const admin = supabaseAdmin as unknown as {
    from: (t: string) => {
      select: (c: string) => {
        eq: (c: string, v: string) => {
          eq: (c: string, v: string) => { maybeSingle: () => Promise<{ data: { organization_id?: string } | null }> };
          maybeSingle: () => Promise<{ data: { organization_id?: string } | null }>;
        };
      };
    };
  };
  if (ev.subscriptionRef) {
    const { data } = await admin
      .from("subscriptions")
      .select("organization_id")
      .eq("provider", ev.provider)
      .eq("provider_subscription_id", ev.subscriptionRef)
      .maybeSingle();
    if (data?.organization_id) return data.organization_id;
  }
  if (ev.customerRef) {
    const { data } = await admin
      .from("subscriptions")
      .select("organization_id")
      .eq("provider", ev.provider)
      .eq("provider_customer_id", ev.customerRef)
      .maybeSingle();
    if (data?.organization_id) return data.organization_id;
  }
  return undefined;
}

/** Sanitiza payload antes de persistir (remove chaves potencialmente sensíveis). */
export function sanitizeWebhookPayload(payload: unknown): Record<string, unknown> {
  const REDACT = new Set([
    "authorization",
    "cookie",
    "password",
    "token",
    "access_token",
    "refresh_token",
    "api_key",
    "secret",
    "webhook_secret",
    "service_role_key",
    "client_secret",
  ]);
  function walk(v: unknown): unknown {
    if (v == null || typeof v !== "object") return v;
    if (Array.isArray(v)) return v.map(walk);
    const out: Record<string, unknown> = {};
    for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
      out[k] = REDACT.has(k.toLowerCase()) ? "[REDACTED]" : walk(val);
    }
    return out;
  }
  const w = walk(payload);
  return (w && typeof w === "object" ? (w as Record<string, unknown>) : { value: w });
}

/**
 * Deriva `subscriptions` patch + `subscription_events.event_type` a partir do
 * evento normalizado. Puro (testável).
 */
export function deriveSubscriptionPatch(
  ev: NormalizedWebhookEvent,
): {
  patch: Record<string, unknown> | null;
  eventType: string;
} {
  const patch: Record<string, unknown> = { provider: ev.provider };
  let eventType = ev.type as string;

  switch (ev.type) {
    case "checkout.completed":
      patch.status = "active";
      if (ev.subscriptionRef) patch.provider_subscription_id = ev.subscriptionRef;
      if (ev.customerRef) patch.provider_customer_id = ev.customerRef;
      if (ev.planCode) patch.plan = ev.planCode;
      if (ev.currentPeriodEnd) patch.current_period_end = ev.currentPeriodEnd;
      patch.cancel_at_period_end = false;
      patch.canceled_at = null;
      eventType = "activated";
      break;
    case "subscription.activated":
      patch.status = "active";
      if (ev.subscriptionRef) patch.provider_subscription_id = ev.subscriptionRef;
      if (ev.customerRef) patch.provider_customer_id = ev.customerRef;
      if (ev.currentPeriodEnd) patch.current_period_end = ev.currentPeriodEnd;
      patch.cancel_at_period_end = ev.cancelAtPeriodEnd ?? false;
      eventType = "activated";
      break;
    case "subscription.updated":
      if (ev.providerStatus) patch.status = mapProviderStatus(ev.providerStatus);
      if (ev.currentPeriodEnd) patch.current_period_end = ev.currentPeriodEnd;
      if (typeof ev.cancelAtPeriodEnd === "boolean")
        patch.cancel_at_period_end = ev.cancelAtPeriodEnd;
      eventType = "updated";
      break;
    case "subscription.canceled":
      patch.status = "cancelled";
      patch.canceled_at = ev.occurredAt;
      patch.cancel_at_period_end = false;
      eventType = "canceled";
      break;
    case "payment.succeeded":
      patch.status = "active";
      if (ev.currentPeriodEnd) patch.current_period_end = ev.currentPeriodEnd;
      eventType = "payment_succeeded";
      break;
    case "payment.failed":
      patch.status = "past_due";
      eventType = "payment_failed";
      break;
    case "payment.refunded":
      eventType = "payment_refunded";
      break;
    case "unknown":
    default:
      return { patch: null, eventType: ev.rawType || "unknown" };
  }
  return { patch, eventType };
}

function mapProviderStatus(s: string): string {
  const v = s.toLowerCase();
  if (v === "active" || v === "trialing") return v;
  if (v === "past_due" || v === "unpaid") return "past_due";
  if (v === "canceled" || v === "cancelled") return "cancelled";
  return v;
}

// ---------------- Persistence ----------------

type AdminChain = {
  eq: (c: string, v: unknown) => AdminChain;
  maybeSingle: () => Promise<{ data: any; error: { message: string } | null }>;
  single: () => Promise<{ data: any; error: { message: string } | null }>;
  select: (c?: string) => AdminChain;
};

const Admin = supabaseAdmin as unknown as {
  from: (t: string) => {
    select: (c?: string) => AdminChain;
    insert: (row: unknown) => AdminChain;
    update: (patch: Record<string, unknown>) => AdminChain;
  };
  rpc: (fn: string, args: Record<string, unknown>) => Promise<{ error: { message: string } | null }>;
};

/**
 * Persiste `webhook_events` com UNIQUE(provider,event_id). Retorna se é duplicado.
 */
export async function persistIdempotency(
  ev: NormalizedWebhookEvent,
  payload: unknown,
  orgId?: string,
): Promise<{ duplicate: boolean; row?: { id: string } }> {
  const { data, error } = await Admin.from("webhook_events")
    .insert({
      provider: ev.provider,
      event_id: ev.eventId,
      event_type: ev.rawType || ev.type,
      organization_id: orgId ?? null,
      payload: sanitizeWebhookPayload(payload),
      status: "received",
    })
    .select("id")
    .single();
  if (error) {
    const msg = error.message.toLowerCase();
    if (msg.includes("duplicate") || msg.includes("unique") || msg.includes("23505")) {
      return { duplicate: true };
    }
    throw new Error(error.message);
  }
  return { duplicate: false, row: data as { id: string } };
}

async function markWebhookStatus(
  id: string,
  status: "processed" | "failed" | "skipped",
  errorMessage?: string,
): Promise<void> {
  try {
    await (Admin.from("webhook_events").update({
      status,
      processed_at: new Date().toISOString(),
      error_message: errorMessage ?? null,
    }) as unknown as AdminChain)
      .eq("id", id)
      .maybeSingle();
  } catch (e) {
    log.warn(
      { event: "webhook_events.update_failed", message: e instanceof Error ? e.message : String(e) },
    );
  }
}

/**
 * Aplica o evento normalizado: idempotência → resolução de org → patch → audit.
 */
export async function processPaymentWebhook(
  ev: NormalizedWebhookEvent,
  rawPayload: unknown,
  logCtx: Record<string, unknown> = {},
): Promise<ProcessResult> {
  const orgId = await resolveOrganizationId(ev);
  const persisted = await persistIdempotency(ev, rawPayload, orgId);
  if (persisted.duplicate) {
    log.info(
      { ...logCtx, event: "webhook.duplicate", provider: ev.provider, event_id: ev.eventId },
      "duplicate webhook ignored",
    );
    return { status: "duplicate", eventType: ev.type };
  }

  const webhookRowId = persisted.row?.id ?? "";

  if (!orgId) {
    await markWebhookStatus(webhookRowId, "skipped", "organization_id não resolvido");
    log.warn(
      { ...logCtx, event: "webhook.no_org", provider: ev.provider, event_id: ev.eventId, type: ev.rawType },
    );
    return { status: "skipped", eventType: ev.type, message: "org não resolvida" };
  }

  const { patch, eventType } = deriveSubscriptionPatch(ev);

  let subscriptionId: string | undefined;

  if (patch) {
    try {
      const currentQuery = await (Admin.from("subscriptions").select(
        "id, plan, provider, provider_subscription_id",
      ) as unknown as AdminChain)
        .eq("organization_id", orgId)
        .maybeSingle();
      const current = currentQuery.data as
        | { id: string; plan: string; provider: string | null }
        | null;

      if (current) {
        const upd = await (Admin.from("subscriptions").update(patch) as unknown as AdminChain)
          .eq("organization_id", orgId)
          .select("id")
          .single();
        subscriptionId = (upd.data as { id: string } | null)?.id;
      }

      // Evento de auditoria de assinatura
      await Admin.from("subscription_events").insert({
        organization_id: orgId,
        subscription_id: subscriptionId ?? null,
        event_type: eventType,
        from_plan_code: current?.plan ?? null,
        to_plan_code: ev.planCode ?? null,
        provider: ev.provider,
        metadata: {
          webhook_event_id: ev.eventId,
          raw_type: ev.rawType,
          amount_cents: ev.amountCents ?? null,
          currency: ev.currency ?? null,
        },
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await markWebhookStatus(webhookRowId, "failed", msg);
      log.error(
        { ...logCtx, event: "webhook.process_failed", provider: ev.provider, event_id: ev.eventId, message: msg },
      );
      return { status: "failed", eventType: ev.type, organizationId: orgId, message: msg };
    }
  }

  // Audit log via helper existente (RPC).
  try {
    await Admin.rpc("app_write_audit_log", {
      _actor_user_id: null,
      _actor_org_id: orgId,
      _action: `webhook:${ev.provider}:${ev.rawType || ev.type}`,
      _entity_type: "subscription",
      _entity_id: subscriptionId ?? null,
      _old_data: null,
      _new_data: patch ?? { type: ev.type, raw_type: ev.rawType },
      _request_id: (logCtx.request_id as string) ?? null,
      _trace_id: (logCtx.trace_id as string) ?? null,
      _ip: (logCtx.ip as string) ?? null,
      _user_agent: (logCtx.user_agent as string) ?? null,
    });
  } catch (e) {
    log.warn(
      { ...logCtx, event: "webhook.audit_failed", provider: ev.provider, event_id: ev.eventId, message: e instanceof Error ? e.message : String(e) },
    );
  }

  await markWebhookStatus(webhookRowId, "processed");
  log.info(
    { ...logCtx, event: "webhook.processed", provider: ev.provider, event_id: ev.eventId, event_type: eventType, organization_id: orgId },
  );

  return { status: "processed", organizationId: orgId, subscriptionId, eventType: ev.type };
}
