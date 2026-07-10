// FEATURE — Marketing Platform Connector · Capability Registry contract
import type { MarketingProvider, AssetKind } from "./assets";

export type CapabilityFlag =
  | "ads" | "analytics" | "tag_management" | "search_console"
  | "merchant" | "gbp" | "youtube" | "pixel" | "capi" | "insight_tag" | "uet";

export type ProviderCapability = {
  provider: MarketingProvider;
  label: string;
  scopes: string[];
  oauthAuthorizeUrl: string | null;   // null = not yet enabled (stub)
  discoverableKinds: AssetKind[];
  capabilities: CapabilityFlag[];
  enabled: boolean;
};
