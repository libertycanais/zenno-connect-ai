// Feature P0.1 — Billing & Subscriptions
// Server functions de gestão de assinatura por organização.
// Aditivo sobre baseline v1.0: preserva `getSubscription` e `changePlan`
// originais e adiciona ciclo de vida completo (checkout, cancel, listEvents).
// Acesso a gateways SEMPRE via Provider Layer (`getPaymentProvider`).

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  getPaymentProvider,
  type PaymentProviderName,
} from "@/providers/payments/payment-provider.factory";
import { sanitizeProviderError } from "@/providers/common/provider.types";

// Preservado para compatibilidade histórica (enum legado de código de plano).
const LegacyPlan = z.enum(["trial", "basico", "completo", "cancelado"]);

const AdminClient = supabaseAdmin as unknown as {
  from: (t: string) => AdminTable;
};
type AdminTable = {
  select: (c?: string) => AdminChain;
  insert: (row: Record<string, unknown>) => AdminChain;
  update: (patch: Record<string, unknown>) => AdminChain;
};
type AdminChain = {
  eq: (col: string, val: unknown) => AdminChain;
  order: (col: string, o?: { ascending?: boolean }) => AdminChain;
  limit: (n: number) => AdminChain;
  maybeSingle: () => Promise<{ data: any; error: { message: string } | null }>;
  single: () => Promise<{ data: any; error: { message: string } | null }>;
  select: (c?: string) => AdminChain;
  then: PromiseLike<{ data: any; error: { message: string } | null }>["then"];
};

async function getOrgId(supabase: any, userId: string): Promise<string> {
  const { data } = await supabase
    .from("profiles")
    .select("organization_id")
    .eq("id", userId)
    .single();
  if (!data?.organization_id) throw new Error("Organização não encontrada");
  return data.organization_id as string;
}

async function recordEvent(input: {
  organization_id: string;
  subscription_id: string | null;
  event_type: string;
  from_plan_code?: string | null;
  to_plan_code?: string | null;
  provider?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  await AdminClient.from("subscription_events").insert({
    organization_id: input.organization_id,
    subscription_id: input.subscription_id,
    event_type: input.event_type,
    from_plan_code: input.from_plan_code ?? null,
    to_plan_code: input.to_plan_code ?? null,
    provider: input.provider ?? null,
    metadata: input.metadata ?? {},
  });
}

// -------------------- READS -------------------------------

export const getSubscription = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const orgId = await getOrgId(supabase, userId);
    let { data } = (await AdminClient.from("subscriptions")
      .select("*")
      .eq("organization_id", orgId)
      .maybeSingle()) as { data: any };
    if (!data) {
      const ins = await AdminClient.from("subscriptions")
        .insert({ organization_id: orgId, plan: "trial", status: "trialing" })
        .select("*")
        .single();
      data = ins.data;
      await recordEvent({
        organization_id: orgId,
        subscription_id: data?.id ?? null,
        event_type: "created",
        to_plan_code: "trial",
      });
    }
    return { subscription: data };
  });

export const listSubscriptionEvents = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const orgId = await getOrgId(context.supabase, context.userId);
    const { data, error } = (await (context.supabase as any)
      .from("subscription_events")
      .select("*")
      .eq("organization_id", orgId)
      .order("created_at", { ascending: false })
      .limit(100)) as { data: any[] | null; error: { message: string } | null };
    if (error) throw new Error(error.message);
    return { events: data ?? [] };
  });

// -------------------- WRITES ------------------------------

/**
 * Compat: mantém contrato original `{ plan: 'trial'|'basico'|'completo'|'cancelado' }`.
 * Novos códigos passam por `startCheckout` / `cancelSubscription`.
 */
export const changePlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { plan: string }) =>
    z.object({ plan: LegacyPlan }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const orgId = await getOrgId(supabase, userId);

    const currentRow = (await AdminClient.from("subscriptions")
      .select("*")
      .eq("organization_id", orgId)
      .maybeSingle()) as { data: any };

    const price =
      data.plan === "basico" ? 2999 : data.plan === "completo" ? 6999 : 0;
    const status =
      data.plan === "cancelado"
        ? "cancelled"
        : data.plan === "trial"
          ? "trialing"
          : "active";
    const period_end =
      data.plan === "basico" || data.plan === "completo"
        ? new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString()
        : null;

    // Resolve plan_id via catálogo (opcional; mantém compatibilidade se ausente).
    const planRow = (await AdminClient.from("plans")
      .select("id, code, sort_order")
      .eq("code", data.plan === "cancelado" ? "trial" : data.plan)
      .maybeSingle()) as { data: any };

    const { data: row, error } = await AdminClient.from("subscriptions")
      .update({
        plan: data.plan,
        plan_id: planRow.data?.id ?? null,
        price_cents: price,
        status,
        current_period_end: period_end,
        cancel_at_period_end: false,
        canceled_at: data.plan === "cancelado" ? new Date().toISOString() : null,
      })
      .eq("organization_id", orgId)
      .select("*")
      .single();
    if (error) throw new Error(error.message);

    const fromCode = currentRow.data?.plan ?? null;
    const toCode = data.plan;
    let eventType: string = "activated";
    if (data.plan === "cancelado") eventType = "canceled";
    else if (fromCode && fromCode !== "trial" && fromCode !== toCode) {
      const fromRow = (await AdminClient.from("plans")
        .select("sort_order")
        .eq("code", fromCode)
        .maybeSingle()) as { data: any };
      const toSort = planRow.data?.sort_order ?? 0;
      const fromSort = fromRow.data?.sort_order ?? 0;
      eventType = toSort > fromSort ? "upgraded" : "downgraded";
    }
    await recordEvent({
      organization_id: orgId,
      subscription_id: row.id,
      event_type: eventType,
      from_plan_code: fromCode,
      to_plan_code: toCode,
    });

    return { subscription: row };
  });

/**
 * Inicia checkout externo via Provider Layer. Não altera `subscriptions`
 * até que o webhook do provider confirme (fluxo futuro).
 * Registra evento `checkout_started` para auditoria.
 */
export const startCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: {
    planCode: string;
    provider?: string;
    successUrl: string;
    cancelUrl: string;
  }) =>
    z
      .object({
        planCode: z
          .string()
          .min(2)
          .max(64)
          .regex(/^[a-z0-9_]+$/i),
        provider: z.enum(["stripe", "mercadopago"]).optional(),
        successUrl: z.string().url(),
        cancelUrl: z.string().url(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const orgId = await getOrgId(context.supabase, context.userId);

    const planRow = (await AdminClient.from("plans")
      .select("id, code, price_cents, currency, name")
      .eq("code", data.planCode)
      .maybeSingle()) as { data: any };
    if (!planRow.data) throw new Error(`Plano '${data.planCode}' não encontrado`);
    if ((planRow.data.price_cents ?? 0) === 0) {
      throw new Error("Plano gratuito não requer checkout");
    }

    // priceId do provider — em Feature P0.1 armazenado por convenção em
    // features.provider_price_id (ADR futuro poderá promover para coluna).
    const featPriceId = (planRow.data as { features?: Record<string, unknown> })
      ?.features?.[`${data.provider ?? "stripe"}_price_id`] as string | undefined;
    if (!featPriceId) {
      throw new Error(
        `priceId do provider ${data.provider ?? "stripe"} não configurado no plano '${data.planCode}'`,
      );
    }

    try {
      const provider = getPaymentProvider(data.provider);
      const session = await provider.createCheckout(
        { organizationId: orgId, userId: context.userId },
        {
          priceId: featPriceId,
          successUrl: data.successUrl,
          cancelUrl: data.cancelUrl,
          metadata: {
            organization_id: orgId,
            plan_code: data.planCode,
          },
        },
      );

      await recordEvent({
        organization_id: orgId,
        subscription_id: null,
        event_type: "checkout_started",
        to_plan_code: data.planCode,
        provider: provider.name,
        metadata: { session_id: session.id },
      });

      return { url: session.url, sessionId: session.id, provider: provider.name };
    } catch (e) {
      throw new Error(sanitizeProviderError(e));
    }
  });

/**
 * Cancela assinatura ativa. `atPeriodEnd=true` (default) preserva acesso
 * até o fim do período pago; `false` cancela imediatamente.
 */
export const cancelSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { atPeriodEnd?: boolean } | undefined) =>
    z
      .object({ atPeriodEnd: z.boolean().optional() })
      .parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    const orgId = await getOrgId(context.supabase, context.userId);
    const atPeriodEnd = data.atPeriodEnd ?? true;

    const sub = (await AdminClient.from("subscriptions")
      .select("*")
      .eq("organization_id", orgId)
      .maybeSingle()) as { data: any };
    if (!sub.data) throw new Error("Assinatura não encontrada");

    // Delega ao Provider Layer quando houver assinatura remota.
    if (sub.data.provider && sub.data.provider_subscription_id) {
      try {
        const provider = getPaymentProvider(
          sub.data.provider as PaymentProviderName,
        );
        await provider.cancelSubscription(
          { organizationId: orgId, userId: context.userId },
          sub.data.provider_subscription_id,
          { atPeriodEnd },
        );
      } catch (e) {
        throw new Error(sanitizeProviderError(e));
      }
    }

    const patch: Record<string, unknown> = atPeriodEnd
      ? { cancel_at_period_end: true }
      : {
          status: "cancelled",
          plan: "cancelado",
          canceled_at: new Date().toISOString(),
          cancel_at_period_end: false,
        };

    const { data: row, error } = await AdminClient.from("subscriptions")
      .update(patch)
      .eq("organization_id", orgId)
      .select("*")
      .single();
    if (error) throw new Error(error.message);

    await recordEvent({
      organization_id: orgId,
      subscription_id: sub.data.id,
      event_type: "canceled",
      from_plan_code: sub.data.plan,
      provider: sub.data.provider ?? null,
      metadata: { atPeriodEnd },
    });

    return { subscription: row };
  });
