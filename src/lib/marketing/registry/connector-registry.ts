// FEATURE — Marketing Platform · Connector Registry
// Maps a MarketingProvider to a concrete MarketingPlatformConnector.
// UI/engines resolve connectors ONLY through this registry.

import type { MarketingPlatformConnector } from "../contracts/connector";
import type { MarketingProvider } from "../contracts/assets";
import { googleConnector } from "../connectors/google.connector";
import { metaConnectorStub } from "../connectors/meta.connector.stub";
import { tiktokConnectorStub } from "../connectors/tiktok.connector.stub";
import { linkedinConnectorStub } from "../connectors/linkedin.connector.stub";
import { microsoftConnectorStub } from "../connectors/microsoft.connector.stub";

const REGISTRY: Record<MarketingProvider, MarketingPlatformConnector> = {
  google: googleConnector,
  meta: metaConnectorStub,
  tiktok: tiktokConnectorStub,
  linkedin: linkedinConnectorStub,
  microsoft: microsoftConnectorStub,
};

export function getConnector(provider: MarketingProvider): MarketingPlatformConnector {
  const c = REGISTRY[provider];
  if (!c) throw new Error(`No connector registered for provider "${provider}"`);
  return c;
}

export function listConnectors(): MarketingPlatformConnector[] {
  return Object.values(REGISTRY);
}
