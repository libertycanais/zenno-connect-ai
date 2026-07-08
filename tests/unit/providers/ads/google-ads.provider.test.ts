import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GoogleAdsProvider } from "@/providers/ads/google-ads.provider";
import { ProviderNotConfiguredError } from "@/providers/common/provider.types";
import { installFetchMock, type FetchMock } from "@tests/mocks/fetch";
import { makeTenantContext } from "@tests/helpers/tenant";

describe("GoogleAdsProvider", () => {
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
    expect(new GoogleAdsProvider().name).toBe("google_ads");
  });

  it("throws ProviderNotConfiguredError when any of the 3 env vars is missing", async () => {
    vi.stubEnv("GOOGLE_ADS_CLIENT_ID", "");
    vi.stubEnv("GOOGLE_ADS_CLIENT_SECRET", "");
    vi.stubEnv("GOOGLE_ADS_DEVELOPER_TOKEN", "");
    const provider = new GoogleAdsProvider();
    await expect(
      provider.connectAccount(makeTenantContext().providerContext, {
        code: "c",
        redirectUri: "https://x",
      }),
    ).rejects.toBeInstanceOf(ProviderNotConfiguredError);
  });

  it("throws ProviderNotConfiguredError for sendConversion without GOOGLE_ADS_CONVERSION_ACTION_ID", async () => {
    vi.stubEnv("GOOGLE_ADS_CLIENT_ID", "id");
    vi.stubEnv("GOOGLE_ADS_CLIENT_SECRET", "sec");
    vi.stubEnv("GOOGLE_ADS_DEVELOPER_TOKEN", "dev");
    vi.stubEnv("GOOGLE_ADS_CONVERSION_ACTION_ID", "");
    const provider = new GoogleAdsProvider();
    await expect(
      provider.sendConversion(
        makeTenantContext().providerContext,
        { accessToken: "t", externalAccountId: "123" },
        { eventName: "Signup", eventTime: 1_700_000_000 },
      ),
    ).rejects.toBeInstanceOf(ProviderNotConfiguredError);
  });

  it("connectAccount returns mapped customer ids", async () => {
    vi.stubEnv("GOOGLE_ADS_CLIENT_ID", "id");
    vi.stubEnv("GOOGLE_ADS_CLIENT_SECRET", "sec");
    vi.stubEnv("GOOGLE_ADS_DEVELOPER_TOKEN", "dev");
    fetchMock.mockResponse("oauth2.googleapis.com/token", { access_token: "TKN" });
    fetchMock.mockResponse("listAccessibleCustomers", {
      resourceNames: ["customers/1111", "customers/2222"],
    });
    const provider = new GoogleAdsProvider();
    const accs = await provider.connectAccount(makeTenantContext().providerContext, {
      code: "c",
      redirectUri: "https://x",
    });
    expect(accs.map((a) => a.id)).toEqual(["1111", "2222"]);
  });

  it("getInsights returns empty array (stub)", async () => {
    const provider = new GoogleAdsProvider();
    await expect(provider.getInsights()).resolves.toEqual([]);
  });

  it("disconnectAccount is best-effort", async () => {
    fetchMock.mockResponder(/revoke/, () => {
      throw new Error("net");
    });
    const provider = new GoogleAdsProvider();
    await expect(
      provider.disconnectAccount(makeTenantContext().providerContext, {
        accessToken: "t",
        externalAccountId: "1",
      }),
    ).resolves.toBeUndefined();
  });
});
