import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { randomBytes } from "crypto";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

function appCreds() {
  const id = process.env.GOOGLE_ADS_CLIENT_ID;
  const secret = process.env.GOOGLE_ADS_CLIENT_SECRET;
  if (!id || !secret) throw new Error("GOOGLE_ADS_CLIENT_ID/SECRET não configurados.");
  return { id, secret };
}

function devToken() {
  const t = process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
  if (!t) throw new Error("GOOGLE_ADS_DEVELOPER_TOKEN não configurado.");
  return t;
}

function baseUrl() {
  return process.env.APP_BASE_URL || "https://zenno-connect-ai.lovable.app";
}

function redirectUri() {
  return `${baseUrl()}/api/public/google-ads/oauth/callback`;
}

// ===== OAUTH =====
export const startGoogleAdsOAuth = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { id } = appCreds();
    const { supabase, userId } = context;
    const { data: prof } = await supabase.from("profiles").select("organization_id").eq("id", userId).single();
    if (!prof?.organization_id) throw new Error("Organização não encontrada.");

    const state = randomBytes(16).toString("hex");
    const payload = Buffer.from(JSON.stringify({ o: prof.organization_id, u: userId, s: state })).toString("base64url");
    const scope = encodeURIComponent("https://www.googleapis.com/auth/adwords");
    const url = `https://accounts.google.com/o/oauth2/v2/auth?response_type=code&client_id=${id}&redirect_uri=${encodeURIComponent(redirectUri())}&scope=${scope}&access_type=offline&prompt=consent&state=${payload}`;
    return { url };
  });

// ===== LIST =====
export const listGoogleAdAccounts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("google_ad_accounts")
      .select("id, name, customer_id, manager_customer_id, currency, timezone, status, token_expires_at, created_at")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { accounts: data ?? [] };
  });

export const disconnectGoogleAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ accountId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("google_ad_accounts").delete().eq("id", data.accountId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ===== TOKEN HELPER =====
async function refreshAccessToken(refreshToken: string) {
  const { id, secret } = appCreds();
  const body = new URLSearchParams({
    client_id: id,
    client_secret: secret,
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  });
  const r = await fetch("https://oauth2.googleapis.com/token", { method: "POST", body });
  const j = await r.json() as { access_token?: string; expires_in?: number };
  if (!r.ok || !j.access_token) throw new Error("Falha ao renovar token Google.");
  return { token: j.access_token, expiresIn: j.expires_in ?? 3600 };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function ensureAccessToken(supabase: any, accountId: string): Promise<any> {
  const { data: acc, error } = await supabase
    .from("google_ad_accounts")
    .select("id, access_token, refresh_token, token_expires_at, customer_id, manager_customer_id, organization_id")
    .eq("id", accountId).single();
  if (error || !acc) throw new Error("Conta não encontrada.");
  const exp = acc.token_expires_at ? new Date(acc.token_expires_at).getTime() : 0;
  if (exp - Date.now() > 60_000 && acc.access_token) return acc;
  if (!acc.refresh_token) throw new Error("Sem refresh token. Reconecte.");
  const { token, expiresIn } = await refreshAccessToken(acc.refresh_token);
  const newExp = new Date(Date.now() + expiresIn * 1000).toISOString();
  await supabase.from("google_ad_accounts").update({ access_token: token, token_expires_at: newExp }).eq("id", accountId);
  return { ...acc, access_token: token, token_expires_at: newExp };
}

// ===== SYNC CAMPAIGNS =====
export const syncGoogleAdsCampaigns = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ accountId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const acc = await ensureAccessToken(supabase, data.accountId);

    const query = `SELECT campaign.id, campaign.name, campaign.status, campaign.advertising_channel_type, campaign.start_date, campaign.end_date FROM campaign LIMIT 200`;
    const url = `https://googleads.googleapis.com/v17/customers/${acc.customer_id}/googleAds:searchStream`;
    const headers: Record<string, string> = {
      Authorization: `Bearer ${acc.access_token}`,
      "developer-token": devToken(),
      "Content-Type": "application/json",
    };
    if (acc.manager_customer_id) headers["login-customer-id"] = String(acc.manager_customer_id);

    const res = await fetch(url, { method: "POST", headers, body: JSON.stringify({ query }) });
    if (!res.ok) {
      const txt = await res.text();
      throw new Error(`Google Ads API: ${res.status} ${txt.slice(0, 300)}`);
    }
    const json = await res.json() as Array<{ results?: Array<{ campaign?: Record<string, unknown> }> }>;
    const all = (Array.isArray(json) ? json : [json]).flatMap((b) => b.results ?? []);
    const rows = all.map((r) => {
      const c = r.campaign ?? {};
      return {
        organization_id: acc.organization_id as string,
        account_id: acc.id as string,
        external_id: String((c as { id?: unknown }).id ?? ""),
        name: String((c as { name?: unknown }).name ?? ""),
        status: (c as { status?: unknown }).status ? String((c as { status?: unknown }).status) : null,
        channel_type: (c as { advertising_channel_type?: unknown }).advertising_channel_type
          ? String((c as { advertising_channel_type?: unknown }).advertising_channel_type) : null,
        budget_amount: null,
        start_date: (c as { start_date?: string }).start_date ?? null,
        end_date: (c as { end_date?: string }).end_date ?? null,
        raw: JSON.parse(JSON.stringify(c)),
        synced_at: new Date().toISOString(),
      };
    }).filter((r) => r.external_id);

    if (rows.length) {
      const { error } = await supabase.from("google_ads_campaigns").upsert(rows, { onConflict: "account_id,external_id" });
      if (error) throw new Error(error.message);
    }
    return { synced: rows.length };
  });

export const listGoogleAdsCampaigns = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ accountId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("google_ads_campaigns")
      .select("id, name, status, channel_type, start_date, end_date, synced_at")
      .eq("account_id", data.accountId)
      .order("synced_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { campaigns: rows ?? [] };
  });

// ===== OFFLINE CONVERSION =====
export const uploadOfflineConversion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    accountId: z.string().uuid(),
    conversionAction: z.string().min(1).max(255),
    gclid: z.string().min(10).max(512),
    conversionDateTime: z.string().min(10),
    value: z.number().nonnegative().optional(),
    currency: z.string().length(3).optional(),
    orderId: z.string().max(64).optional(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const acc = await ensureAccessToken(supabase, data.accountId);

    const { data: logRow } = await supabase.from("google_ads_conversions").insert({
      organization_id: acc.organization_id as string,
      account_id: acc.id as string,
      conversion_action: data.conversionAction,
      gclid: data.gclid,
      conversion_date_time: new Date(data.conversionDateTime).toISOString(),
      conversion_value: data.value ?? null,
      currency: data.currency ?? null,
      order_id: data.orderId ?? null,
      status: "pending",
    }).select("id").single();

    const url = `https://googleads.googleapis.com/v17/customers/${acc.customer_id}:uploadClickConversions`;
    const headers: Record<string, string> = {
      Authorization: `Bearer ${acc.access_token}`,
      "developer-token": devToken(),
      "Content-Type": "application/json",
    };
    if (acc.manager_customer_id) headers["login-customer-id"] = String(acc.manager_customer_id);

    const body = {
      conversions: [{
        gclid: data.gclid,
        conversionAction: data.conversionAction,
        conversionDateTime: data.conversionDateTime,
        conversionValue: data.value,
        currencyCode: data.currency,
        orderId: data.orderId,
      }],
      partialFailure: true,
    };

    const res = await fetch(url, { method: "POST", headers, body: JSON.stringify(body) });
    const respJson = await res.json().catch(() => ({}));

    if (logRow?.id) {
      await supabase.from("google_ads_conversions").update({
        status: res.ok ? "sent" : "error",
        response: JSON.parse(JSON.stringify(respJson ?? {})),
        error: res.ok ? null : `HTTP ${res.status}`,
        sent_at: new Date().toISOString(),
      }).eq("id", logRow.id);
    }
    if (!res.ok) throw new Error(`Google Ads conv: ${res.status}`);
    return { ok: true };
  });

export const listGoogleAdsConversions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("google_ads_conversions")
      .select("id, conversion_action, gclid, conversion_date_time, conversion_value, currency, status, error, sent_at, created_at")
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return { conversions: data ?? [] };
  });
