// FEATURE — Marketing Platform · Capability Registry
// Drives the Wizard: which providers exist, which scopes they need, which
// asset kinds they can discover. Adding a new provider = add an entry here.

import type { ProviderCapability } from "../contracts/capability";
import type { MarketingProvider } from "../contracts/assets";

export const CAPABILITY_REGISTRY: Record<MarketingProvider, ProviderCapability> = {
  google: {
    provider: "google",
    label: "Google Marketing Platform",
    scopes: [
      "https://www.googleapis.com/auth/adwords",
      "https://www.googleapis.com/auth/analytics.readonly",
      "https://www.googleapis.com/auth/webmasters.readonly",
      "https://www.googleapis.com/auth/tagmanager.readonly",
      "https://www.googleapis.com/auth/content",
      "https://www.googleapis.com/auth/business.manage",
      "openid", "email", "profile",
    ],
    oauthAuthorizeUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    discoverableKinds: [
      "google_ads_account", "ga4_property", "gsc_property", "gtm_container",
      "merchant_center", "gbp_location", "youtube_channel",
    ],
    capabilities: ["ads", "analytics", "tag_management", "search_console", "merchant", "gbp", "youtube"],
    enabled: true,
  },
  meta: {
    provider: "meta",
    label: "Meta Business Suite",
    scopes: ["ads_management", "business_management", "pages_show_list", "instagram_basic"],
    oauthAuthorizeUrl: null, // stub — enable in future feature
    discoverableKinds: ["meta_ad_account", "meta_pixel", "meta_page", "meta_instagram", "meta_capi_dataset"],
    capabilities: ["ads", "pixel", "capi"],
    enabled: false,
  },
  tiktok: {
    provider: "tiktok",
    label: "TikTok for Business",
    scopes: ["business_basic", "advertiser.read"],
    oauthAuthorizeUrl: null,
    discoverableKinds: ["tiktok_ad_account", "tiktok_pixel", "tiktok_business"],
    capabilities: ["ads", "pixel"],
    enabled: false,
  },
  linkedin: {
    provider: "linkedin",
    label: "LinkedIn Marketing",
    scopes: ["r_ads", "r_ads_reporting", "r_organization_social"],
    oauthAuthorizeUrl: null,
    discoverableKinds: ["linkedin_ad_account", "linkedin_page", "linkedin_insight_tag"],
    capabilities: ["ads", "insight_tag"],
    enabled: false,
  },
  microsoft: {
    provider: "microsoft",
    label: "Microsoft Advertising",
    scopes: ["https://ads.microsoft.com/msads.manage"],
    oauthAuthorizeUrl: null,
    discoverableKinds: ["microsoft_ad_account", "microsoft_uet"],
    capabilities: ["ads", "uet"],
    enabled: false,
  },
};

export function listProviders(): ProviderCapability[] {
  return Object.values(CAPABILITY_REGISTRY);
}

export function listEnabledProviders(): ProviderCapability[] {
  return listProviders().filter((p) => p.enabled);
}

export function getCapability(provider: MarketingProvider): ProviderCapability {
  const cap = CAPABILITY_REGISTRY[provider];
  if (!cap) throw new Error(`Unknown provider: ${provider}`);
  return cap;
}
