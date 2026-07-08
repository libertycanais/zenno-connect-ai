import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  getPaymentProvider,
  listPaymentProviders,
} from "@/providers/payments/payment-provider.factory";
import { StripeProvider } from "@/providers/payments/stripe.provider";
import { MercadoPagoProvider } from "@/providers/payments/mercadopago.provider";
import { UnknownProviderError } from "@/providers/common/provider.types";

describe("payment-provider.factory", () => {
  beforeEach(() => vi.unstubAllEnvs());
  afterEach(() => vi.unstubAllEnvs());

  it("registers stripe + mercadopago", () => {
    expect(listPaymentProviders()).toEqual(expect.arrayContaining(["stripe", "mercadopago"]));
  });

  it("defaults to stripe", () => {
    vi.stubEnv("PAYMENT_PROVIDER", "");
    expect(getPaymentProvider()).toBeInstanceOf(StripeProvider);
  });

  it("selects mercadopago via env", () => {
    vi.stubEnv("PAYMENT_PROVIDER", "mercadopago");
    expect(getPaymentProvider()).toBeInstanceOf(MercadoPagoProvider);
  });

  it("throws UnknownProviderError for unregistered", () => {
    expect(() => getPaymentProvider("asaas")).toThrow(UnknownProviderError);
  });
});
