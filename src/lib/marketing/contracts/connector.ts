// FEATURE — Enterprise Marketing Platform Connector v1.0
// The single contract that every marketing provider must implement.
// UI and engines depend ONLY on this interface — never on provider SDKs.

import type { MarketingProvider, PlatformAsset, AssetHealth } from "./assets";
import type { MarketingTimelineEvent } from "./timeline";

export type ConnectorContext = {
  organizationId: string;
  userId: string;
  connectionId?: string;
};

export type ConnectStartResult = {
  authorizeUrl: string;
  state: string;
};

export type ConnectorTokens = {
  accessToken: string;
  refreshToken?: string | null;
  expiresAt?: string | null;
  scopes: string[];
};

export type DiscoveryResult = {
  assets: PlatformAsset[];
  timeline?: MarketingTimelineEvent[];
};

export type SyncResult = {
  assetKind: string;
  externalId: string;
  changed: number;
  raw?: Record<string, unknown>;
};

export type HealthResult = AssetHealth;

export interface MarketingPlatformConnector {
  readonly provider: MarketingProvider;
  readonly label: string;

  /** Build the provider authorize URL. Persistence of state is caller's job. */
  connect(ctx: ConnectorContext, opts: { state: string; redirectUri: string; scopes?: string[] }): Promise<ConnectStartResult>;

  /** Exchange OAuth code for tokens. */
  exchangeCode(opts: { code: string; redirectUri: string }): Promise<ConnectorTokens>;

  /** Refresh access token if the provider supports it. */
  refresh(tokens: ConnectorTokens): Promise<ConnectorTokens>;

  /** Enumerate all assets accessible with the given tokens. */
  discoverAssets(tokens: ConnectorTokens, ctx: ConnectorContext): Promise<DiscoveryResult>;

  /** Sync a single asset (light metadata refresh — heavy pulls happen in domain modules). */
  syncAsset(tokens: ConnectorTokens, asset: PlatformAsset): Promise<SyncResult>;

  /** Compute health for an asset based on last sync metadata. */
  health(input: { asset: PlatformAsset; lastSyncedAt: string | null; lastError: string | null }): HealthResult;

  /** Revoke tokens on the provider side (best-effort). */
  disconnect?(tokens: ConnectorTokens): Promise<void>;
}
