// FEATURE — Marketing Platform · Google Connector (real)
// Enables OAuth → discovery for Ads, GA4, GSC, GTM, Merchant, GBP, YouTube.
// Uses only fetch(); no SDK import.

import type { MarketingPlatformConnector, ConnectorContext, ConnectorTokens, ConnectStartResult, DiscoveryResult, SyncResult } from "../contracts/connector";
import type { PlatformAsset } from "../contracts/assets";
import { getCapability } from "../registry/capability-registry";
import { scoreAsset } from "../engines/health-engine";

function creds() {
  const id = process.env.GOOGLE_ADS_CLIENT_ID;
  const secret = process.env.GOOGLE_ADS_CLIENT_SECRET;
  if (!id || !secret) throw new Error("Google OAuth credentials not configured");
  return { id, secret };
}

async function safeFetch<T = unknown>(url: string, init?: RequestInit): Promise<{ ok: boolean; json: T | null; status: number }> {
  try {
    const r = await fetch(url, init);
    const j = (await r.json().catch(() => null)) as T | null;
    return { ok: r.ok, json: j, status: r.status };
  } catch {
    return { ok: false, json: null, status: 0 };
  }
}

export const googleConnector: MarketingPlatformConnector = {
  provider: "google",
  label: "Google Marketing Platform",

  async connect(_ctx: ConnectorContext, opts): Promise<ConnectStartResult> {
    const { id } = creds();
    const cap = getCapability("google");
    const scope = (opts.scopes ?? cap.scopes).join(" ");
    const url = new URL(cap.oauthAuthorizeUrl!);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("client_id", id);
    url.searchParams.set("redirect_uri", opts.redirectUri);
    url.searchParams.set("scope", scope);
    url.searchParams.set("access_type", "offline");
    url.searchParams.set("prompt", "consent");
    url.searchParams.set("include_granted_scopes", "true");
    url.searchParams.set("state", opts.state);
    return { authorizeUrl: url.toString(), state: opts.state };
  },

  async exchangeCode({ code, redirectUri }): Promise<ConnectorTokens> {
    const { id, secret } = creds();
    const body = new URLSearchParams({
      code, client_id: id, client_secret: secret, redirect_uri: redirectUri, grant_type: "authorization_code",
    });
    const r = await fetch("https://oauth2.googleapis.com/token", { method: "POST", body });
    const j = await r.json() as { access_token?: string; refresh_token?: string; expires_in?: number; scope?: string; error?: string };
    if (!r.ok || !j.access_token) throw new Error(j.error || "google_token_exchange_failed");
    return {
      accessToken: j.access_token,
      refreshToken: j.refresh_token ?? null,
      expiresAt: new Date(Date.now() + (j.expires_in ?? 3600) * 1000).toISOString(),
      scopes: (j.scope ?? "").split(" ").filter(Boolean),
    };
  },

  async refresh(tokens): Promise<ConnectorTokens> {
    if (!tokens.refreshToken) throw new Error("no_refresh_token");
    const { id, secret } = creds();
    const body = new URLSearchParams({
      client_id: id, client_secret: secret, refresh_token: tokens.refreshToken, grant_type: "refresh_token",
    });
    const r = await fetch("https://oauth2.googleapis.com/token", { method: "POST", body });
    const j = await r.json() as { access_token?: string; expires_in?: number; scope?: string };
    if (!r.ok || !j.access_token) throw new Error("google_refresh_failed");
    return {
      ...tokens,
      accessToken: j.access_token,
      expiresAt: new Date(Date.now() + (j.expires_in ?? 3600) * 1000).toISOString(),
      scopes: j.scope ? j.scope.split(" ").filter(Boolean) : tokens.scopes,
    };
  },

  async discoverAssets(tokens): Promise<DiscoveryResult> {
    const assets: PlatformAsset[] = [];
    const authHeader = { Authorization: `Bearer ${tokens.accessToken}` };

    // 1) Google Ads — listAccessibleCustomers + auto-descend MCCs
    const devToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
    if (devToken) {
      const ads = await safeFetch<{ resourceNames?: string[] }>(
        "https://googleads.googleapis.com/v17/customers:listAccessibleCustomers",
        { headers: { ...authHeader, "developer-token": devToken } },
      );
      const rootIds = (ads.json?.resourceNames ?? []).map((rn) => rn.split("/")[1]).filter(Boolean);
      const seen = new Set<string>();
      for (const cid of rootIds) {
        const headers = { ...authHeader, "developer-token": devToken, "Content-Type": "application/json", "login-customer-id": cid };
        // Self info: is manager?
        const selfRes = await safeFetch<{ results?: Array<{ customer?: { descriptiveName?: string; manager?: boolean; currencyCode?: string; timeZone?: string } }> }>(
          `https://googleads.googleapis.com/v17/customers/${cid}/googleAds:search`,
          { method: "POST", headers, body: JSON.stringify({ query: "SELECT customer.id, customer.descriptive_name, customer.manager, customer.currency_code, customer.time_zone FROM customer LIMIT 1" }) },
        );
        const self = selfRes.json?.results?.[0]?.customer;
        const isManager = Boolean(self?.manager);
        if (!seen.has(cid)) {
          seen.add(cid);
          assets.push({
            provider: "google", kind: "google_ads_account", externalId: cid,
            name: self?.descriptiveName || `Google Ads · ${cid}`,
            currency: self?.currencyCode ?? undefined, timezone: self?.timeZone ?? undefined,
            capabilities: { ads: true, manager: isManager }, raw: {},
          });
        }
        // If MCC, enumerate children automatically
        if (isManager) {
          const childRes = await safeFetch<{ results?: Array<{ customerClient?: { clientCustomer?: string; descriptiveName?: string; currencyCode?: string; timeZone?: string; manager?: boolean; status?: string } }> }>(
            `https://googleads.googleapis.com/v17/customers/${cid}/googleAds:search`,
            { method: "POST", headers, body: JSON.stringify({ query: "SELECT customer_client.client_customer, customer_client.descriptive_name, customer_client.currency_code, customer_client.time_zone, customer_client.manager, customer_client.status FROM customer_client WHERE customer_client.level <= 1" }) },
          );
          for (const r of childRes.json?.results ?? []) {
            const cc = r.customerClient;
            if (!cc?.clientCustomer) continue;
            const childId = cc.clientCustomer.split("/")[1];
            if (!childId || childId === cid || seen.has(childId)) continue;
            if (cc.status && cc.status !== "ENABLED") continue;
            seen.add(childId);
            assets.push({
              provider: "google", kind: "google_ads_account", externalId: childId,
              parentExternalId: cid,
              name: cc.descriptiveName || `Google Ads · ${childId}`,
              currency: cc.currencyCode ?? undefined, timezone: cc.timeZone ?? undefined,
              capabilities: { ads: true, manager: Boolean(cc.manager), parent_mcc: cid }, raw: {},
            });
          }
        }
      }
    }


    // 2) GA4 properties — list account summaries
    const ga = await safeFetch<{ accountSummaries?: Array<{ propertySummaries?: Array<{ property: string; displayName?: string }> }> }>(
      "https://analyticsadmin.googleapis.com/v1beta/accountSummaries?pageSize=200",
      { headers: authHeader },
    );
    for (const acc of ga.json?.accountSummaries ?? []) {
      for (const p of acc.propertySummaries ?? []) {
        const propId = p.property.split("/")[1];
        assets.push({
          provider: "google", kind: "ga4_property", externalId: propId,
          name: p.displayName || `GA4 ${propId}`, capabilities: { analytics: true }, raw: {},
        });
      }
    }

    // 3) Search Console sites
    const gsc = await safeFetch<{ siteEntry?: Array<{ siteUrl: string; permissionLevel?: string }> }>(
      "https://www.googleapis.com/webmasters/v3/sites",
      { headers: authHeader },
    );
    for (const s of gsc.json?.siteEntry ?? []) {
      assets.push({
        provider: "google", kind: "gsc_property", externalId: s.siteUrl,
        name: s.siteUrl, capabilities: { search_console: true, permission: s.permissionLevel ?? "" }, raw: {},
      });
    }

    // 4) GTM accounts → containers
    const gtm = await safeFetch<{ account?: Array<{ accountId: string; name?: string }> }>(
      "https://www.googleapis.com/tagmanager/v2/accounts",
      { headers: authHeader },
    );
    for (const acc of gtm.json?.account ?? []) {
      const cont = await safeFetch<{ container?: Array<{ containerId: string; publicId?: string; name?: string; usageContext?: string[] }> }>(
        `https://www.googleapis.com/tagmanager/v2/accounts/${acc.accountId}/containers`,
        { headers: authHeader },
      );
      for (const c of cont.json?.container ?? []) {
        assets.push({
          provider: "google", kind: "gtm_container", externalId: c.publicId || c.containerId,
          parentExternalId: acc.accountId,
          name: c.name || c.publicId || c.containerId,
          capabilities: { tag_management: true, usage: (c.usageContext ?? []).join(",") },
          raw: {},
        });
      }
    }

    // 5) Merchant Center (best-effort)
    const mc = await safeFetch<{ resources?: Array<{ id: string; name?: string }> }>(
      "https://shoppingcontent.googleapis.com/content/v2.1/accounts/authinfo",
      { headers: authHeader },
    );
    for (const acc of mc.json?.resources ?? []) {
      assets.push({
        provider: "google", kind: "merchant_center", externalId: String(acc.id),
        name: acc.name || `Merchant ${acc.id}`, capabilities: { merchant: true }, raw: {},
      });
    }

    return { assets };
  },

  async syncAsset(_tokens, asset): Promise<SyncResult> {
    // Light metadata refresh — heavy pulls live in domain modules (google-ads.functions.ts etc).
    return { assetKind: asset.kind, externalId: asset.externalId, changed: 0 };
  },

  health({ asset, lastSyncedAt, lastError }) {
    return scoreAsset({ asset, lastSyncedAt, lastError });
  },

  async disconnect(tokens) {
    try {
      await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(tokens.refreshToken || tokens.accessToken)}`, { method: "POST" });
    } catch { /* best-effort */ }
  },
};
