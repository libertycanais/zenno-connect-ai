// Helpers server-only para atribuição (Meta CAPI + Google Offline Conversion).
// Importar SEMPRE de dentro de um handler (nunca no topo de arquivos client-reachable):
//   const { dispatchMetaCapi, registerGoogleOfflineConversion } = await import("@/lib/attribution.server");

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { createHash } from "crypto";

const sha = (v: string) => createHash("sha256").update(v.trim().toLowerCase()).digest("hex");

export type AttributionInput = {
  organizationId: string;
  eventName: "Lead" | "Purchase" | "InitiateChat";
  eventSourceUrl?: string | null;
  fbclid?: string | null;
  gclid?: string | null;
  email?: string | null;
  phone?: string | null;
  value?: number | null;
  currency?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  externalId?: string | null;
  actionSource?: "website" | "business_messaging" | "chat" | "system_generated";
};

export async function dispatchMetaCapi(input: AttributionInput) {
  if (!input.fbclid && !input.email && !input.phone && !input.externalId) return { skipped: "no_identifier" };

  const { data: metaAcc } = await supabaseAdmin
    .from("meta_ad_accounts")
    .select("id, access_token, pixel_id")
    .eq("organization_id", input.organizationId)
    .eq("status", "active")
    .not("pixel_id", "is", null)
    .limit(1)
    .maybeSingle();
  if (!metaAcc?.pixel_id || !metaAcc.access_token) return { skipped: "no_pixel" };

  const eventId = `${Date.now()}-${(input.externalId ?? input.phone ?? Math.random().toString(36)).slice(-10)}`;
  const user_data: Record<string, string | string[]> = {};
  if (input.email) user_data.em = sha(input.email);
  if (input.phone) user_data.ph = sha(input.phone.replace(/\D/g, ""));
  if (input.externalId) user_data.external_id = sha(input.externalId);
  if (input.ip) user_data.client_ip_address = input.ip;
  if (input.userAgent) user_data.client_user_agent = input.userAgent;
  if (input.fbclid) user_data.fbc = `fb.1.${Math.floor(Date.now() / 1000)}.${input.fbclid}`;

  const custom_data: Record<string, unknown> = {};
  if (input.value != null) custom_data.value = input.value;
  if (input.currency) custom_data.currency = input.currency;

  const body = {
    data: [{
      event_name: input.eventName,
      event_time: Math.floor(Date.now() / 1000),
      event_id: eventId,
      action_source: input.actionSource ?? "website",
      event_source_url: input.eventSourceUrl ?? undefined,
      user_data,
      custom_data,
    }],
  };

  const res = await fetch(
    `https://graph.facebook.com/v20.0/${metaAcc.pixel_id}/events?access_token=${metaAcc.access_token}`,
    { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) },
  );
  const respJson = await res.json().catch(() => ({}));

  await supabaseAdmin.from("meta_conversion_events").insert({
    organization_id: input.organizationId,
    ad_account_id: metaAcc.id,
    pixel_id: metaAcc.pixel_id,
    event_name: input.eventName,
    event_id: eventId,
    event_source_url: input.eventSourceUrl ?? null,
    user_data: JSON.parse(JSON.stringify(user_data)),
    custom_data: JSON.parse(JSON.stringify(custom_data)),
    status: res.ok ? "sent" : "error",
    response: JSON.parse(JSON.stringify(respJson ?? {})),
    error: res.ok ? null : `HTTP ${res.status}`,
    sent_at: new Date().toISOString(),
  });

  return { sent: res.ok, eventId };
}

export async function registerGoogleOfflineConversion(input: AttributionInput) {
  if (!input.gclid) return { skipped: "no_gclid" };
  const { data: gAcc } = await supabaseAdmin
    .from("google_ad_accounts")
    .select("id")
    .eq("organization_id", input.organizationId)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();
  await supabaseAdmin.from("google_ads_conversions").insert({
    organization_id: input.organizationId,
    account_id: gAcc?.id ?? null,
    conversion_action: input.eventName === "Purchase" ? "purchase" : "lead",
    gclid: input.gclid,
    conversion_date_time: new Date().toISOString(),
    conversion_value: input.value ?? null,
    currency: input.currency ?? null,
    status: "pending",
  });
  return { registered: true };
}
