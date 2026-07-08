// Google Ads adapter — encapsula chamadas googleads.googleapis.com.
// Server-only.
import {
  ProviderError,
  ProviderNotConfiguredError,
  type ProviderContext,
} from "@/providers/common/provider.types";
import type {
  AdsAccountConnection,
  AdsAccountRef,
  AdsCampaign,
  AdsConversionEvent,
  AdsInsight,
  AdsProvider,
} from "@/providers/ads/ads-provider.interface";

const OAUTH = "https://oauth2.googleapis.com";
const API = "https://googleads.googleapis.com/v17";

function requireEnv() {
  const clientId = process.env.GOOGLE_ADS_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_ADS_CLIENT_SECRET;
  const devToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
  const missing: string[] = [];
  if (!clientId) missing.push("GOOGLE_ADS_CLIENT_ID");
  if (!clientSecret) missing.push("GOOGLE_ADS_CLIENT_SECRET");
  if (!devToken) missing.push("GOOGLE_ADS_DEVELOPER_TOKEN");
  if (missing.length) throw new ProviderNotConfiguredError("google_ads", missing);
  return { clientId: clientId!, clientSecret: clientSecret!, devToken: devToken! };
}

export class GoogleAdsProvider implements AdsProvider {
  readonly name = "google_ads";

  async connectAccount(
    _ctx: ProviderContext,
    input: { code: string; redirectUri: string },
  ): Promise<AdsAccountRef[]> {
    const { clientId, clientSecret, devToken } = requireEnv();
    const tokenRes = await fetch(`${OAUTH}/token`, {
      method: "POST",
      body: new URLSearchParams({
        code: input.code, client_id: clientId, client_secret: clientSecret,
        redirect_uri: input.redirectUri, grant_type: "authorization_code",
      }),
    });
    const tokens = await tokenRes.json() as { access_token?: string; error?: string };
    if (!tokenRes.ok || !tokens.access_token) {
      throw new ProviderError("google_ads", "token_exchange_failed", tokens.error ?? "token_failed");
    }
    const listRes = await fetch(`${API}/customers:listAccessibleCustomers`, {
      headers: { Authorization: `Bearer ${tokens.access_token}`, "developer-token": devToken },
    });
    const listJson = await listRes.json() as { resourceNames?: string[] };
    const ids = (listJson.resourceNames ?? []).map((rn) => rn.split("/")[1]).filter(Boolean);
    return ids.map((id) => ({ id, name: `Customer ${id}`, isManager: false }));
  }

  async getCampaigns(_ctx: ProviderContext, conn: AdsAccountConnection): Promise<AdsCampaign[]> {
    const { devToken } = requireEnv();
    const res = await fetch(`${API}/customers/${conn.externalAccountId}/googleAds:search`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${conn.accessToken}`,
        "developer-token": devToken,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query: "SELECT campaign.id, campaign.name, campaign.status, campaign.advertising_channel_type FROM campaign LIMIT 500",
      }),
    });
    const json = await res.json() as {
      results?: Array<{ campaign?: { id: string; name: string; status: string; advertisingChannelType?: string } }>;
    };
    return (json.results ?? [])
      .filter((r) => r.campaign)
      .map((r) => ({
        id: r.campaign!.id, name: r.campaign!.name, status: r.campaign!.status,
        objective: r.campaign!.advertisingChannelType ?? null,
      }));
  }

  async getInsights(): Promise<AdsInsight[]> {
    // Não implementado nesta migração — mantém contrato para futura evolução.
    return [];
  }

  async sendConversion(
    _ctx: ProviderContext, conn: AdsAccountConnection, event: AdsConversionEvent,
  ): Promise<{ ok: boolean }> {
    const { devToken } = requireEnv();
    const conversionActionId = process.env.GOOGLE_ADS_CONVERSION_ACTION_ID;
    if (!conversionActionId) throw new ProviderNotConfiguredError("google_ads", ["GOOGLE_ADS_CONVERSION_ACTION_ID"]);
    const res = await fetch(`${API}/customers/${conn.externalAccountId}:uploadClickConversions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${conn.accessToken}`,
        "developer-token": devToken,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        conversions: [{
          conversionAction: `customers/${conn.externalAccountId}/conversionActions/${conversionActionId}`,
          conversionDateTime: new Date(event.eventTime * 1000).toISOString().replace("T", " ").replace("Z", "+00:00"),
          conversionValue: event.value ?? 0,
          currencyCode: event.currency ?? "USD",
        }],
        partialFailure: true,
      }),
    });
    if (!res.ok) throw new ProviderError("google_ads", "conversion_failed", (await res.text()).slice(0, 200));
    return { ok: true };
  }

  async disconnectAccount(_ctx: ProviderContext, conn: AdsAccountConnection): Promise<void> {
    try {
      await fetch(`${OAUTH}/revoke?token=${encodeURIComponent(conn.accessToken)}`, { method: "POST" });
    } catch {
      /* best-effort */
    }
  }
}
