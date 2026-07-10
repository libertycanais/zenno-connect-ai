// FEATURE — Enterprise Marketing Platform Connector v1.0
// Contracts · Asset primitives. Additive. Zero I/O.

export type MarketingProvider = "google" | "meta" | "tiktok" | "linkedin" | "microsoft";

export type AssetKind =
  // Google
  | "google_ads_account" | "ga4_property" | "gsc_property" | "gtm_container"
  | "merchant_center" | "gbp_location" | "youtube_channel"
  // Meta
  | "meta_ad_account" | "meta_pixel" | "meta_page" | "meta_instagram" | "meta_capi_dataset"
  // TikTok
  | "tiktok_ad_account" | "tiktok_pixel" | "tiktok_business"
  // LinkedIn
  | "linkedin_ad_account" | "linkedin_page" | "linkedin_insight_tag"
  // Microsoft
  | "microsoft_ad_account" | "microsoft_uet"
  ;

export type AssetHealthStatus = "online" | "warning" | "offline" | "unknown";

export type PlatformAsset = {
  provider: MarketingProvider;
  kind: AssetKind;
  externalId: string;
  parentExternalId?: string | null;
  name: string;
  currency?: string | null;
  timezone?: string | null;
  capabilities: Record<string, boolean | string | number>;
  raw?: Record<string, unknown>;
};

export type AssetHealth = {
  score: number;               // 0..100
  status: AssetHealthStatus;
  reasons: Array<{ code: string; message: string; severity: "info" | "warning" | "error" }>;
  measuredAt: string;
};
