import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { StripeProvider } from "@/providers/payments/stripe.provider";
import {
  ProviderError,
  ProviderNotConfiguredError,
} from "@/providers/common/provider.types";
import { installFetchMock, type FetchMock } from "@tests/mocks/fetch";
import { makeTenantContext } from "@tests/helpers/tenant";

describe("StripeProvider", () => {
  let fetchMock: FetchMock;

  beforeEach(() => {
    vi.unstubAllEnvs();
    fetchMock = installFetchMock();
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_dummy");
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("has stable name", () => {
    expect(new StripeProvider().name).toBe("stripe");
  });

  it("createCustomer requires STRIPE_SECRET_KEY", async () => {
    vi.stubEnv("STRIPE_SECRET_KEY", "");
    await expect(
      new StripeProvider().createCustomer(makeTenantContext().providerContext, {
        email: "u@e.com",
      }),
    ).rejects.toBeInstanceOf(ProviderNotConfiguredError);
  });

  it("createCustomer parses response", async () => {
    fetchMock.mockResponse("/customers", { id: "cus_1", email: "u@e.com", name: "U" });
    const c = await new StripeProvider().createCustomer(
      makeTenantContext().providerContext,
      { email: "u@e.com", name: "U", metadata: { org: "o1" } },
    );
    expect(c).toEqual({ id: "cus_1", email: "u@e.com", name: "U" });
  });

  it("createSubscription maps current_period_end", async () => {
    fetchMock.mockResponse("/subscriptions", {
      id: "sub_1",
      status: "active",
      current_period_end: 1_700_000_000,
    });
    const s = await new StripeProvider().createSubscription(
      makeTenantContext().providerContext,
      { customerId: "cus_1", priceId: "price_1", trialDays: 7 },
    );
    expect(s.id).toBe("sub_1");
    expect(s.status).toBe("active");
    expect(s.currentPeriodEnd).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("getPaymentStatus maps stripe status → canonical", async () => {
    fetchMock.mockResponse("/payment_intents/pi_1", {
      status: "succeeded",
      amount_received: 12345,
      currency: "brl",
    });
    const st = await new StripeProvider().getPaymentStatus(
      makeTenantContext().providerContext,
      "pi_1",
    );
    expect(st).toMatchObject({ status: "paid", amount: 123.45, currency: "brl" });
  });

  it("wraps stripe api errors as ProviderError", async () => {
    fetchMock.mockResponder("/customers", () =>
      new Response(JSON.stringify({ error: { message: "bad_key" } }), { status: 401 }),
    );
    await expect(
      new StripeProvider().createCustomer(makeTenantContext().providerContext, {
        email: "u@e.com",
      }),
    ).rejects.toBeInstanceOf(ProviderError);
  });
});
