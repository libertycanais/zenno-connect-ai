import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createHash, randomBytes } from "crypto";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const GRAPH = "https://graph.facebook.com/v20.0";

function appCreds() {
  const id = process.env.META_APP_ID;
  const secret = process.env.META_APP_SECRET;
  if (!id || !secret) throw new Error("META_APP_ID/SECRET não configurados.");
  return { id, secret };
}

function appBaseUrl(): string {
  return process.env.APP_BASE_URL || "https://zenno-connect-ai.lovable.app";
}

function redirectUri() {
  return `${appBaseUrl()}/api/public/meta/oauth/callback`;
}

// =================== OAUTH ===================
export const startMetaOAuth = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { id } = appCreds();
    const { supabase, userId } = context;
    const { data: prof } = await supabase.from("profiles").select("organization_id").eq("id", userId).single();
    if (!prof?.organization_id) throw new Error("Organização não encontrada.");

    const state = randomBytes(16).toString("hex");
    // Encode org+user+nonce. In production, persist this to verify on callback.
    const payload = Buffer.from(JSON.stringify({ o: prof.organization_id, u: userId, s: state })).toString("base64url");

    const scopes = ["ads_management", "ads_read", "business_management", "pages_show_list"].join(",");
    const url = `https://www.facebook.com/v20.0/dialog/oauth?client_id=${id}&redirect_uri=${encodeURIComponent(redirectUri())}&state=${payload}&scope=${scopes}&response_type=code`;
    return { url };
  });

// =================== LISTAR CONTAS ===================
export const listMetaAccounts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data, error } = await supabase
      .from("meta_ad_accounts")
      .select("id, name, ad_account_id, business_id, pixel_id, status, token_expires_at, created_at")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { accounts: data ?? [] };
  });

export const updatePixelId = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ accountId: z.string().uuid(), pixelId: z.string().min(1).max(64) }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("meta_ad_accounts")
      .update({ pixel_id: data.pixelId })
      .eq("id", data.accountId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const disconnectMetaAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ accountId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("meta_ad_accounts").delete().eq("id", data.accountId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// =================== SYNC CAMPANHAS ===================
export const syncMetaCampaigns = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ accountId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: acc, error } = await supabase
      .from("meta_ad_accounts")
      .select("id, organization_id, ad_account_id, access_token")
      .eq("id", data.accountId)
      .single();
    if (error || !acc) throw new Error("Conta não encontrada.");
    if (!acc.access_token) throw new Error("Conta sem token. Reconecte.");

    const url = `${GRAPH}/act_${acc.ad_account_id}/campaigns?fields=id,name,objective,status,daily_budget,lifetime_budget,start_time,stop_time&limit=100&access_token=${acc.access_token}`;
    const res = await fetch(url);
    if (!res.ok) {
      const txt = await res.text();
      throw new Error(`Meta API: ${res.status} ${txt.slice(0, 200)}`);
    }
    const json = await res.json() as { data?: Array<Record<string, unknown>> };
    const rows = (json.data ?? []).map((c) => ({
      organization_id: acc.organization_id,
      ad_account_id: acc.id,
      external_id: String(c.id),
      name: String(c.name ?? ""),
      objective: c.objective ? String(c.objective) : null,
      status: c.status ? String(c.status) : null,
      daily_budget: c.daily_budget ? Number(c.daily_budget) / 100 : null,
      lifetime_budget: c.lifetime_budget ? Number(c.lifetime_budget) / 100 : null,
      start_time: c.start_time ? String(c.start_time) : null,
      stop_time: c.stop_time ? String(c.stop_time) : null,
      raw: JSON.parse(JSON.stringify(c)),
      synced_at: new Date().toISOString(),
    }));
    if (rows.length) {
      const { error: upErr } = await supabase.from("meta_campaigns").upsert(rows, { onConflict: "ad_account_id,external_id" });
      if (upErr) throw new Error(upErr.message);
    }
    return { synced: rows.length };
  });

export const listMetaCampaigns = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ accountId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("meta_campaigns")
      .select("id, name, objective, status, daily_budget, lifetime_budget, start_time, stop_time, synced_at")
      .eq("ad_account_id", data.accountId)
      .order("synced_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { campaigns: rows ?? [] };
  });

// =================== CONVERSION API ===================
function sha256Lower(v: string) {
  return createHash("sha256").update(v.trim().toLowerCase()).digest("hex");
}

export const sendConversionEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      accountId: z.string().uuid(),
      eventName: z.string().min(1).max(64),
      email: z.string().email().optional(),
      phone: z.string().max(32).optional(),
      eventSourceUrl: z.string().url().optional(),
      value: z.number().nonnegative().optional(),
      currency: z.string().length(3).optional(),
      testEventCode: z.string().max(64).optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: acc, error } = await supabase
      .from("meta_ad_accounts")
      .select("id, organization_id, access_token, pixel_id")
      .eq("id", data.accountId)
      .single();
    if (error || !acc) throw new Error("Conta não encontrada.");
    if (!acc.pixel_id) throw new Error("Pixel ID não configurado.");
    if (!acc.access_token) throw new Error("Conta sem token.");

    const user_data: Record<string, string> = {};
    if (data.email) user_data.em = sha256Lower(data.email);
    if (data.phone) user_data.ph = sha256Lower(data.phone.replace(/\D/g, ""));

    const event_id = `${Date.now()}-${randomBytes(4).toString("hex")}`;
    const event_time = Math.floor(Date.now() / 1000);
    const custom_data: Record<string, unknown> = {};
    if (data.value != null) custom_data.value = data.value;
    if (data.currency) custom_data.currency = data.currency;

    const { data: logRow } = await supabase.from("meta_conversion_events").insert({
      organization_id: acc.organization_id,
      ad_account_id: acc.id,
      pixel_id: acc.pixel_id,
      event_name: data.eventName,
      event_id,
      event_source_url: data.eventSourceUrl ?? null,
      user_data,
      custom_data,
      test_event_code: data.testEventCode ?? null,
      status: "pending",
    }).select("id").single();

    const body: Record<string, unknown> = {
      data: [{
        event_name: data.eventName,
        event_time,
        event_id,
        action_source: "website",
        event_source_url: data.eventSourceUrl,
        user_data,
        custom_data,
      }],
    };
    if (data.testEventCode) body.test_event_code = data.testEventCode;

    const res = await fetch(`${GRAPH}/${acc.pixel_id}/events?access_token=${acc.access_token}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const respJson = await res.json().catch(() => ({}));

    if (logRow?.id) {
      await supabase.from("meta_conversion_events").update({
        status: res.ok ? "sent" : "error",
        response: JSON.parse(JSON.stringify(respJson ?? {})),
        error: res.ok ? null : `HTTP ${res.status}`,
        sent_at: new Date().toISOString(),
      }).eq("id", logRow.id);
    }

    void userId;
    if (!res.ok) throw new Error(`Conversion API: ${res.status}`);
    return { ok: true, eventId: event_id, response: respJson };
  });

export const listConversionEvents = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("meta_conversion_events")
      .select("id, event_name, event_time, status, error, pixel_id, sent_at, created_at")
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return { events: data ?? [] };
  });
