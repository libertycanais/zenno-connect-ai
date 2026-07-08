// Meta Ads adapter — encapsula chamadas Graph API.
// Server-only. Nunca importar em código client.
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

const GRAPH = "https://graph.facebook.com/v20.0";

function requireEnv() {
  const appId = process.env.META_APP_ID;
  const appSecret = process.env.META_APP_SECRET;
  const missing: string[] = [];
  if (!appId) missing.push("META_APP_ID");
  if (!appSecret) missing.push("META_APP_SECRET");
  if (missing.length) throw new ProviderNotConfiguredError("meta", missing);
  return { appId: appId!, appSecret: appSecret! };
}

export class MetaAdsProvider implements AdsProvider {
  readonly name = "meta";

  async connectAccount(
    _ctx: ProviderContext,
    input: { code: string; redirectUri: string },
  ): Promise<AdsAccountRef[]> {
    const { appId, appSecret } = requireEnv();
    const tokenRes = await fetch(
      `${GRAPH}/oauth/access_token?client_id=${appId}&redirect_uri=${encodeURIComponent(input.redirectUri)}&client_secret=${appSecret}&code=${input.code}`,
    );
    const tokenJson = await tokenRes.json() as { access_token?: string; error?: { message: string } };
    if (!tokenRes.ok || !tokenJson.access_token) {
      throw new ProviderError("meta", "token_exchange_failed", tokenJson.error?.message ?? "token_failed");
    }
    const accRes = await fetch(
      `${GRAPH}/me/adaccounts?fields=account_id,name,currency&limit=200&access_token=${tokenJson.access_token}`,
    );
    const accJson = await accRes.json() as { data?: Array<{ account_id: string; name: string; currency?: string }> };
    return (accJson.data ?? []).map((a) => ({
      id: a.account_id, name: a.name, currency: a.currency ?? null, isManager: false,
    }));
  }

  async getCampaigns(_ctx: ProviderContext, conn: AdsAccountConnection): Promise<AdsCampaign[]> {
    const res = await fetch(
      `${GRAPH}/act_${conn.externalAccountId}/campaigns?fields=id,name,status,objective&limit=200&access_token=${conn.accessToken}`,
    );
    const json = await res.json() as { data?: Array<{ id: string; name: string; status: string; objective?: string }> };
    return (json.data ?? []).map((c) => ({ id: c.id, name: c.name, status: c.status, objective: c.objective ?? null }));
  }

  async getInsights(
    _ctx: ProviderContext, conn: AdsAccountConnection, range: { since: string; until: string },
  ): Promise<AdsInsight[]> {
    const params = new URLSearchParams({
      level: "campaign",
      fields: "campaign_id,impressions,clicks,spend,actions,date_start",
      time_range: JSON.stringify({ since: range.since, until: range.until }),
      time_increment: "1",
      limit: "500",
      access_token: conn.accessToken,
    });
    const res = await fetch(`${GRAPH}/act_${conn.externalAccountId}/insights?${params}`);
    const json = await res.json() as { data?: Array<Record<string, string | Array<{ action_type: string; value: string }>>> };
    return (json.data ?? []).map((r) => ({
      campaignId: String(r.campaign_id),
      date: String(r.date_start),
      impressions: Number(r.impressions || 0),
      clicks: Number(r.clicks || 0),
      spend: Number(r.spend || 0),
      conversions: Array.isArray(r.actions)
        ? r.actions.reduce((s, a) => s + Number(a.value || 0), 0) : 0,
    }));
  }

  async sendConversion(
    _ctx: ProviderContext, conn: AdsAccountConnection, event: AdsConversionEvent,
  ): Promise<{ ok: boolean; externalId?: string }> {
    const pixelId = process.env.META_PIXEL_ID;
    if (!pixelId) throw new ProviderNotConfiguredError("meta", ["META_PIXEL_ID"]);
    const res = await fetch(`${GRAPH}/${pixelId}/events?access_token=${conn.accessToken}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        data: [{
          event_name: event.eventName,
          event_time: event.eventTime,
          action_source: "website",
          user_data: event.userData ?? {},
          custom_data: {
            ...(event.customData ?? {}),
            value: event.value,
            currency: event.currency,
          },
        }],
      }),
    });
    if (!res.ok) {
      const err = await res.text();
      throw new ProviderError("meta", "conversion_failed", err.slice(0, 200));
    }
    const json = await res.json() as { events_received?: number; fbtrace_id?: string };
    return { ok: (json.events_received ?? 0) > 0, externalId: json.fbtrace_id };
  }

  async disconnectAccount(_ctx: ProviderContext, conn: AdsAccountConnection): Promise<void> {
    // Meta não expõe revoke por conta; a desconexão é lógica (remover do banco).
    // Best-effort: revogar permissions do app para o usuário atual, se disponível.
    try {
      await fetch(`${GRAPH}/me/permissions?access_token=${conn.accessToken}`, { method: "DELETE" });
    } catch {
      /* best-effort */
    }
  }
}
