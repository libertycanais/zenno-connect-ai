// MercadoPago adapter — stub inicial mantendo a interface unificada.
// Endpoints implementados sob demanda conforme migração de features.
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

const API = "https://api.mercadopago.com";

function token() {
  const t = process.env.MERCADOPAGO_ACCESS_TOKEN;
  if (!t) throw new ProviderNotConfiguredError("mercadopago", ["MERCADOPAGO_ACCESS_TOKEN"]);
  return t;
}

export class MercadoPagoProvider implements PaymentProvider {
  readonly name = "mercadopago";

  async createCustomer(_ctx: ProviderContext, input: { email: string; name?: string }): Promise<PaymentCustomer> {
    const res = await fetch(`${API}/v1/customers`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token()}`, "Content-Type": "application/json" },
      body: JSON.stringify({ email: input.email, first_name: input.name }),
    });
    const json = await res.json() as { id?: string; email?: string; message?: string };
    if (!res.ok) throw new ProviderError("mercadopago", "customer_failed", json.message ?? "error");
    return { id: String(json.id), email: json.email };
  }

  async createSubscription(): Promise<PaymentSubscription> {
    throw new ProviderError("mercadopago", "not_implemented",
      "createSubscription não implementado — implementar quando MercadoPago for ativado.");
  }
  async cancelSubscription(): Promise<PaymentSubscription> {
    throw new ProviderError("mercadopago", "not_implemented", "cancelSubscription não implementado.");
  }
  async getPaymentStatus(_ctx: ProviderContext, paymentId: string): Promise<PaymentStatus> {
    const res = await fetch(`${API}/v1/payments/${paymentId}`, {
      headers: { Authorization: `Bearer ${token()}` },
    });
    const json = await res.json() as { status?: string; transaction_amount?: number; currency_id?: string };
    if (!res.ok) throw new ProviderError("mercadopago", "status_failed", "error");
    const map: Record<string, PaymentStatus["status"]> = {
      approved: "paid", pending: "pending", in_process: "pending",
      rejected: "failed", refunded: "refunded", cancelled: "canceled",
    };
    return { status: map[json.status ?? "pending"] ?? "pending", amount: json.transaction_amount, currency: json.currency_id };
  }
  async createCheckout(): Promise<PaymentCheckoutSession> {
    throw new ProviderError("mercadopago", "not_implemented", "createCheckout não implementado — usar preferences API.");
  }
}
