import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MercadoPagoProvider } from "@/providers/payments/mercadopago.provider";
import {
  ProviderError,
  ProviderNotConfiguredError,
} from "@/providers/common/provider.types";
import { installFetchMock, type FetchMock } from "@tests/mocks/fetch";
import { makeTenantContext } from "@tests/helpers/tenant";

describe("MercadoPagoProvider", () => {
  let fetchMock: FetchMock;

  beforeEach(() => {
    vi.unstubAllEnvs();
    fetchMock = installFetchMock();
    vi.stubEnv("MERCADOPAGO_ACCESS_TOKEN", "mp-token");
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("has stable name", () => {
    expect(new MercadoPagoProvider().name).toBe("mercadopago");
  });

  it("createCustomer requires MERCADOPAGO_ACCESS_TOKEN", async () => {
    vi.stubEnv("MERCADOPAGO_ACCESS_TOKEN", "");
    await expect(
      new MercadoPagoProvider().createCustomer(makeTenantContext().providerContext, {
        email: "u@e.com",
      }),
    ).rejects.toBeInstanceOf(ProviderNotConfiguredError);
  });

  it("createCustomer parses response", async () => {
    fetchMock.mockResponse("/v1/customers", { id: "cust_1", email: "u@e.com" });
    const c = await new MercadoPagoProvider().createCustomer(
      makeTenantContext().providerContext,
      { email: "u@e.com" },
    );
    expect(c).toEqual({ id: "cust_1", email: "u@e.com" });
  });

  it("unimplemented methods throw ProviderError", async () => {
    await expect(new MercadoPagoProvider().createSubscription()).rejects.toBeInstanceOf(
      ProviderError,
    );
    await expect(new MercadoPagoProvider().cancelSubscription()).rejects.toBeInstanceOf(
      ProviderError,
    );
    await expect(new MercadoPagoProvider().createCheckout()).rejects.toBeInstanceOf(
      ProviderError,
    );
  });

  it("getPaymentStatus maps mp status → canonical", async () => {
    fetchMock.mockResponse("/v1/payments/1", {
      status: "approved",
      transaction_amount: 50,
      currency_id: "BRL",
    });
    const st = await new MercadoPagoProvider().getPaymentStatus(
      makeTenantContext().providerContext,
      "1",
    );
    expect(st).toMatchObject({ status: "paid", amount: 50, currency: "BRL" });
  });
});
