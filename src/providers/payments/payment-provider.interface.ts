import type { ProviderContext } from "@/providers/common/provider.types";

export type PaymentCustomer = { id: string; email?: string; name?: string };
export type PaymentSubscription = {
  id: string;
  status: "trialing" | "active" | "past_due" | "canceled" | "unpaid" | "incomplete";
  currentPeriodEnd?: string;
};
export type PaymentCheckoutSession = {
  id: string;
  url: string;
};
export type PaymentStatus = {
  status: "paid" | "pending" | "failed" | "refunded" | "canceled";
  amount?: number;
  currency?: string;
};

/**
 * Interface unificada para gateways de pagamento (Stripe, MercadoPago, Asaas, etc).
 */
export interface PaymentProvider {
  readonly name: string;
  createCustomer(
    ctx: ProviderContext,
    input: { email: string; name?: string; metadata?: Record<string, string> },
  ): Promise<PaymentCustomer>;
  createSubscription(
    ctx: ProviderContext,
    input: { customerId: string; priceId: string; trialDays?: number },
  ): Promise<PaymentSubscription>;
  cancelSubscription(
    ctx: ProviderContext,
    subscriptionId: string,
    opts?: { atPeriodEnd?: boolean },
  ): Promise<PaymentSubscription>;
  getPaymentStatus(ctx: ProviderContext, paymentId: string): Promise<PaymentStatus>;
  createCheckout(
    ctx: ProviderContext,
    input: {
      customerId?: string;
      priceId: string;
      successUrl: string;
      cancelUrl: string;
      metadata?: Record<string, string>;
    },
  ): Promise<PaymentCheckoutSession>;
}
