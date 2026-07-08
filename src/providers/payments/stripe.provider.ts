// Stripe adapter — implementação stub que preserva a interface unificada.
// Sem dependência do SDK oficial (fetch direto na API REST) para evitar bundling
// pesado no worker. Consumers só dependem da interface.
import {
  ProviderError,
  ProviderNotConfiguredError,
  type ProviderContext,
} from "@/providers/common/provider.types";
import type {
  PaymentCheckoutSession,
  PaymentCustomer,
  PaymentProvider,
  PaymentStatus,
  PaymentSubscription,
} from "@/providers/payments/payment-provider.interface";

const API = "https://api.stripe.com/v1";

function key() {
  const k = process.env.STRIPE_SECRET_KEY;
  if (!k) throw new ProviderNotConfiguredError("stripe", ["STRIPE_SECRET_KEY"]);
  return k;
}

async function stripeFetch(path: string, body?: Record<string, string>): Promise<Record<string, unknown>> {
  const res = await fetch(`${API}${path}`, {
    method: body ? "POST" : "GET",
    headers: {
      Authorization: `Bearer ${key()}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body ? new URLSearchParams(body).toString() : undefined,
  });
  const json = await res.json() as Record<string, unknown>;
  if (!res.ok) throw new ProviderError("stripe", "api_error", (json.error as { message?: string })?.message ?? "stripe_error");
  return json;
}

export class StripeProvider implements PaymentProvider {
  readonly name = "stripe";

  async createCustomer(_ctx: ProviderContext, input: { email: string; name?: string; metadata?: Record<string, string> }): Promise<PaymentCustomer> {
    const body: Record<string, string> = { email: input.email };
    if (input.name) body.name = input.name;
    for (const [k, v] of Object.entries(input.metadata ?? {})) body[`metadata[${k}]`] = v;
    const c = await stripeFetch("/customers", body);
    return { id: String(c.id), email: String(c.email ?? input.email), name: (c.name as string | null) ?? undefined };
  }

  async createSubscription(_ctx: ProviderContext, input: { customerId: string; priceId: string; trialDays?: number }): Promise<PaymentSubscription> {
    const body: Record<string, string> = {
      customer: input.customerId,
      "items[0][price]": input.priceId,
    };
    if (input.trialDays) body.trial_period_days = String(input.trialDays);
    const s = await stripeFetch("/subscriptions", body);
    return {
      id: String(s.id),
      status: s.status as PaymentSubscription["status"],
      currentPeriodEnd: s.current_period_end ? new Date(Number(s.current_period_end) * 1000).toISOString() : undefined,
    };
  }

  async cancelSubscription(_ctx: ProviderContext, subscriptionId: string, opts?: { atPeriodEnd?: boolean }): Promise<PaymentSubscription> {
    if (opts?.atPeriodEnd) {
      const s = await stripeFetch(`/subscriptions/${subscriptionId}`, { cancel_at_period_end: "true" });
      return { id: String(s.id), status: s.status as PaymentSubscription["status"] };
    }
    const res = await fetch(`${API}/subscriptions/${subscriptionId}`, {
      method: "DELETE", headers: { Authorization: `Bearer ${key()}` },
    });
    const s = await res.json() as Record<string, unknown>;
    if (!res.ok) throw new ProviderError("stripe", "cancel_failed", (s.error as { message?: string })?.message ?? "cancel_error");
    return { id: String(s.id), status: s.status as PaymentSubscription["status"] };
  }

  async getPaymentStatus(_ctx: ProviderContext, paymentId: string): Promise<PaymentStatus> {
    const p = await stripeFetch(`/payment_intents/${paymentId}`);
    const map: Record<string, PaymentStatus["status"]> = {
      succeeded: "paid", processing: "pending", requires_payment_method: "pending",
      requires_action: "pending", canceled: "canceled",
    };
    return {
      status: map[String(p.status)] ?? "pending",
      amount: p.amount_received ? Number(p.amount_received) / 100 : undefined,
      currency: p.currency as string | undefined,
    };
  }

  async createCheckout(_ctx: ProviderContext, input: { customerId?: string; priceId: string; successUrl: string; cancelUrl: string; metadata?: Record<string, string> }): Promise<PaymentCheckoutSession> {
    const body: Record<string, string> = {
      mode: "subscription",
      "line_items[0][price]": input.priceId,
      "line_items[0][quantity]": "1",
      success_url: input.successUrl,
      cancel_url: input.cancelUrl,
    };
    if (input.customerId) body.customer = input.customerId;
    for (const [k, v] of Object.entries(input.metadata ?? {})) body[`metadata[${k}]`] = v;
    const s = await stripeFetch("/checkout/sessions", body);
    return { id: String(s.id), url: String(s.url) };
  }
}
