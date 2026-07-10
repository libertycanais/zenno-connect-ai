// FEATURE — Marketing Platform Connector · Sync tiers
import type { AssetKind } from "./assets";

export type SyncTier = "hot" | "warm" | "cold";

export type SyncPolicy = {
  tier: SyncTier;
  intervalSeconds: number;
  maxBackoffSeconds: number;
};

export const SYNC_POLICY_BY_KIND: Record<AssetKind, SyncPolicy> = {
  // Hot (15 min)
  google_ads_account:  { tier: "hot",  intervalSeconds: 15 * 60, maxBackoffSeconds: 60 * 60 },
  meta_ad_account:     { tier: "hot",  intervalSeconds: 15 * 60, maxBackoffSeconds: 60 * 60 },
  tiktok_ad_account:   { tier: "hot",  intervalSeconds: 15 * 60, maxBackoffSeconds: 60 * 60 },
  linkedin_ad_account: { tier: "hot",  intervalSeconds: 15 * 60, maxBackoffSeconds: 60 * 60 },
  microsoft_ad_account:{ tier: "hot",  intervalSeconds: 15 * 60, maxBackoffSeconds: 60 * 60 },
  // Warm (30 min)
  ga4_property:        { tier: "warm", intervalSeconds: 30 * 60, maxBackoffSeconds: 2 * 60 * 60 },
  meta_pixel:          { tier: "warm", intervalSeconds: 30 * 60, maxBackoffSeconds: 2 * 60 * 60 },
  tiktok_pixel:        { tier: "warm", intervalSeconds: 30 * 60, maxBackoffSeconds: 2 * 60 * 60 },
  linkedin_insight_tag:{ tier: "warm", intervalSeconds: 30 * 60, maxBackoffSeconds: 2 * 60 * 60 },
  microsoft_uet:       { tier: "warm", intervalSeconds: 30 * 60, maxBackoffSeconds: 2 * 60 * 60 },
  gtm_container:       { tier: "warm", intervalSeconds: 30 * 60, maxBackoffSeconds: 2 * 60 * 60 },
  meta_capi_dataset:   { tier: "warm", intervalSeconds: 30 * 60, maxBackoffSeconds: 2 * 60 * 60 },
  // Cold
  gsc_property:        { tier: "cold", intervalSeconds: 6 * 3600,  maxBackoffSeconds: 24 * 3600 },
  merchant_center:     { tier: "cold", intervalSeconds: 12 * 3600, maxBackoffSeconds: 24 * 3600 },
  gbp_location:        { tier: "cold", intervalSeconds: 24 * 3600, maxBackoffSeconds: 48 * 3600 },
  youtube_channel:     { tier: "cold", intervalSeconds: 12 * 3600, maxBackoffSeconds: 24 * 3600 },
  meta_page:           { tier: "cold", intervalSeconds: 12 * 3600, maxBackoffSeconds: 24 * 3600 },
  meta_instagram:      { tier: "cold", intervalSeconds: 12 * 3600, maxBackoffSeconds: 24 * 3600 },
  linkedin_page:       { tier: "cold", intervalSeconds: 12 * 3600, maxBackoffSeconds: 24 * 3600 },
  tiktok_business:     { tier: "cold", intervalSeconds: 12 * 3600, maxBackoffSeconds: 24 * 3600 },
};

export function policyFor(kind: AssetKind): SyncPolicy {
  return SYNC_POLICY_BY_KIND[kind] ?? { tier: "cold", intervalSeconds: 12 * 3600, maxBackoffSeconds: 24 * 3600 };
}

export function computeNextRun(now: Date, policy: SyncPolicy, attempts: number): { nextRunAt: Date; backoffSeconds: number } {
  if (attempts <= 0) return { nextRunAt: new Date(now.getTime() + policy.intervalSeconds * 1000), backoffSeconds: 0 };
  const backoff = Math.min(policy.maxBackoffSeconds, policy.intervalSeconds * Math.pow(2, attempts - 1));
  return { nextRunAt: new Date(now.getTime() + backoff * 1000), backoffSeconds: backoff };
}
