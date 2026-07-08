import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  getAdsProvider,
  listAdsProviders,
} from "@/providers/ads/ads-provider.factory";
import { MetaAdsProvider } from "@/providers/ads/meta-ads.provider";
import { GoogleAdsProvider } from "@/providers/ads/google-ads.provider";
import { UnknownProviderError } from "@/providers/common/provider.types";

describe("ads-provider.factory", () => {
  beforeEach(() => vi.unstubAllEnvs());
  afterEach(() => vi.unstubAllEnvs());

  it("lists all registered providers", () => {
    expect(listAdsProviders()).toEqual(expect.arrayContaining(["meta", "google_ads"]));
  });

  it("defaults to meta when no ENV / arg is set", () => {
    delete process.env.ADS_PROVIDER;
    expect(getAdsProvider()).toBeInstanceOf(MetaAdsProvider);
  });

  it("selects google_ads via ENV", () => {
    vi.stubEnv("ADS_PROVIDER", "google_ads");
    expect(getAdsProvider()).toBeInstanceOf(GoogleAdsProvider);
  });

  it("explicit arg overrides ENV", () => {
    vi.stubEnv("ADS_PROVIDER", "meta");
    expect(getAdsProvider("google_ads")).toBeInstanceOf(GoogleAdsProvider);
  });

  it("is case-insensitive", () => {
    expect(getAdsProvider("META")).toBeInstanceOf(MetaAdsProvider);
    expect(getAdsProvider("Google_Ads")).toBeInstanceOf(GoogleAdsProvider);
  });

  it("throws UnknownProviderError for unregistered provider", () => {
    expect(() => getAdsProvider("yahoo")).toThrow(UnknownProviderError);
    try {
      getAdsProvider("yahoo");
    } catch (e) {
      expect(e).toBeInstanceOf(UnknownProviderError);
      expect((e as UnknownProviderError).message).toContain("meta");
      expect((e as UnknownProviderError).message).toContain("google_ads");
    }
  });

  it("factory returns a fresh instance per call (stateless registry)", () => {
    const a = getAdsProvider("meta");
    const b = getAdsProvider("meta");
    expect(a).not.toBe(b);
    expect(a.name).toBe("meta");
    expect(b.name).toBe("meta");
  });
});
