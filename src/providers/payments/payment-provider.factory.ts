import { UnknownProviderError } from "@/providers/common/provider.types";
import type { PaymentProvider } from "@/providers/payments/payment-provider.interface";
import { StripeProvider } from "@/providers/payments/stripe.provider";
import { MercadoPagoProvider } from "@/providers/payments/mercadopago.provider";

const SUPPORTED = ["stripe", "mercadopago"] as const;
export type PaymentProviderName = typeof SUPPORTED[number];

const registry: Record<PaymentProviderName, () => PaymentProvider> = {
  stripe: () => new StripeProvider(),
  mercadopago: () => new MercadoPagoProvider(),
};

export function getPaymentProvider(name?: string): PaymentProvider {
  const requested = (name ?? process.env.PAYMENT_PROVIDER ?? "stripe").toLowerCase() as PaymentProviderName;
  const factory = registry[requested];
  if (!factory) throw new UnknownProviderError("payment", requested, [...SUPPORTED]);
  return factory();
}

export function listPaymentProviders(): readonly string[] {
  return SUPPORTED;
}
