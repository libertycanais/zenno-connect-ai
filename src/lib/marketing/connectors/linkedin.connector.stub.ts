import type { MarketingPlatformConnector } from "../contracts/connector";
import { scoreAsset } from "../engines/health-engine";
function notEnabled(): never { throw new Error("LinkedIn connector is not enabled yet"); }
export const linkedinConnectorStub: MarketingPlatformConnector = {
  provider: "linkedin",
  label: "LinkedIn Marketing",
  async connect() { notEnabled(); },
  async exchangeCode() { notEnabled(); },
  async refresh() { notEnabled(); },
  async discoverAssets() { return { assets: [] }; },
  async syncAsset(_t, a) { return { assetKind: a.kind, externalId: a.externalId, changed: 0 }; },
  health({ asset, lastSyncedAt, lastError }) { return scoreAsset({ asset, lastSyncedAt, lastError }); },
};
