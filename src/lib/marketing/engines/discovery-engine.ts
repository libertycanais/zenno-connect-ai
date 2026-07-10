// FEATURE — Marketing Platform · Generic Discovery Engine
// Provider-agnostic. Delegates to connector.discoverAssets().

import type { MarketingProvider, PlatformAsset } from "../contracts/assets";
import type { ConnectorContext, ConnectorTokens, DiscoveryResult } from "../contracts/connector";
import { getConnector } from "../registry/connector-registry";

export async function discoverPlatformAssets(
  provider: MarketingProvider,
  tokens: ConnectorTokens,
  ctx: ConnectorContext,
): Promise<DiscoveryResult> {
  const connector = getConnector(provider);
  const started = Date.now();
  const result = await connector.discoverAssets(tokens, ctx);
  return {
    assets: result.assets,
    timeline: [
      ...(result.timeline ?? []),
      {
        organizationId: ctx.organizationId,
        connectionId: ctx.connectionId ?? null,
        provider,
        eventType: "discovery.completed",
        severity: "info",
        payload: { count: result.assets.length, durationMs: Date.now() - started },
        occurredAt: new Date().toISOString(),
      },
    ],
  };
}

export function groupByKind(assets: PlatformAsset[]): Record<string, PlatformAsset[]> {
  const out: Record<string, PlatformAsset[]> = {};
  for (const a of assets) (out[a.kind] ??= []).push(a);
  return out;
}
