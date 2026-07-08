import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MetaAdsProvider } from "@/providers/ads/meta-ads.provider";
import { ProviderNotConfiguredError } from "@/providers/common/provider.types";
import { installFetchMock, type FetchMock } from "@tests/mocks/fetch";
import { makeTenantContext } from "@tests/helpers/tenant";

describe("MetaAdsProvider", () => {
  let fetchMock: FetchMock;

  beforeEach(() => {
    vi.unstubAllEnvs();
    fetchMock = installFetchMock();
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("has stable name", () => {
    expect(new MetaAdsProvider().name).toBe("meta");
  });

  it("throws ProviderNotConfiguredError when META_APP_ID/SECRET missing", async () => {
    vi.stubEnv("META_APP_ID", "");
    vi.stubEnv("META_APP_SECRET", "");
    const provider = new MetaAdsProvider();
    const { providerContext } = makeTenantContext();
    await expect(
      provider.connectAccount(providerContext, { code: "x", redirectUri: "https://x" }),
    ).rejects.toBeInstanceOf(ProviderNotConfiguredError);
  });

  it("throws ProviderNotConfiguredError for sendConversion without META_PIXEL_ID", async () => {
    vi.stubEnv("META_PIXEL_ID", "");
    const provider = new MetaAdsProvider();
    const { providerContext } = makeTenantContext();
    await expect(
      provider.sendConversion(
        providerContext,
        { accessToken: "t", externalAccountId: "1" },
        { eventName: "Purchase", eventTime: 1 },
      ),
    ).rejects.toBeInstanceOf(ProviderNotConfiguredError);
  });

  it("connectAccount returns mapped ad accounts", async () => {
    vi.stubEnv("META_APP_ID", "app");
    vi.stubEnv("META_APP_SECRET", "sec");
    fetchMock.mockResponse("oauth/access_token", { access_token: "TKN" });
    fetchMock.mockResponse("/me/adaccounts", {
      data: [
        { account_id: "act_1", name: "One", currency: "BRL" },
        { account_id: "act_2", name: "Two" },
      ],
    });
    const provider = new MetaAdsProvider();
    const accs = await provider.connectAccount(makeTenantContext().providerContext, {
      code: "c",
      redirectUri: "https://x",
    });
    expect(accs).toHaveLength(2);
    expect(accs[0]).toMatchObject({ id: "act_1", name: "One", currency: "BRL" });
  });

  it("connectAccount surfaces sanitized errors on failure", async () => {
    vi.stubEnv("META_APP_ID", "app");
    vi.stubEnv("META_APP_SECRET", "sec");
    fetchMock.mockResponder("oauth/access_token", () =>
      new Response(JSON.stringify({ error: { message: "invalid grant" } }), { status: 400 }),
    );
    const provider = new MetaAdsProvider();
    await expect(
      provider.connectAccount(makeTenantContext().providerContext, {
        code: "c",
        redirectUri: "https://x",
      }),
    ).rejects.toThrow(/token_exchange_failed/);
  });

  it("disconnectAccount is best-effort (swallows errors)", async () => {
    fetchMock.mockResponder(/permissions/, () => {
      throw new Error("network");
    });
    const provider = new MetaAdsProvider();
    await expect(
      provider.disconnectAccount(makeTenantContext().providerContext, {
        accessToken: "t",
        externalAccountId: "1",
      }),
    ).resolves.toBeUndefined();
  });
});
