import { UnknownProviderError } from "@/providers/common/provider.types";
import type { AdsProvider } from "@/providers/ads/ads-provider.interface";
import { MetaAdsProvider } from "@/providers/ads/meta-ads.provider";
import { GoogleAdsProvider } from "@/providers/ads/google-ads.provider";

const SUPPORTED = ["meta", "google_ads"] as const;
export type AdsProviderName = typeof SUPPORTED[number];

const registry: Record<AdsProviderName, () => AdsProvider> = {
  meta: () => new MetaAdsProvider(),
  google_ads: () => new GoogleAdsProvider(),
};

/**
 * Retorna o provider por nome. Se omitido, usa ADS_PROVIDER do ambiente
 * (default 'meta').
 */
export function getAdsProvider(name?: string): AdsProvider {
  const requested = (name ?? process.env.ADS_PROVIDER ?? "meta").toLowerCase() as AdsProviderName;
  const factory = registry[requested];
  if (!factory) throw new UnknownProviderError("ads", requested, [...SUPPORTED]);
  return factory();
}

export function listAdsProviders(): readonly string[] {
  return SUPPORTED;
}
