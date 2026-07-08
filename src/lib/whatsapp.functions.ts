import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// Thin proxy to Uazapi (or any compatible WhatsApp HTTP API).
// Credentials (token, webhook_secret) live in the DB row and are read
// server-side only via the admin client, scoped to the caller's organization.

async function uazapiFetch(baseUrl: string, token: string, path: string, init?: RequestInit) {
  const url = new URL(path.replace(/^\//, ""), baseUrl.endsWith("/") ? baseUrl : baseUrl + "/");
  const res = await fetch(url.toString(), {
    ...init,
    headers: {
      "Content-Type": "application/json",
      token,
      ...(init?.headers ?? {}),
    },
  });
  const text = await res.text();
  let data: any;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!res.ok) throw new Error(`Uazapi ${res.status}: ${typeof data === "string" ? data : JSON.stringify(data)}`);
  return data as any;
}

type AnyRec = Record<string, any>;

async function getOrgId(supabase: any, userId: string) {
  const { data } = await supabase.from("profiles").select("organization_id").eq("id", userId).single();
  if (!data) throw new Error("Perfil não encontrado");
  return data.organization_id as string;
}

async function getInstance(supabase: any, userId: string, id: string) {
  const organization_id = await getOrgId(supabase, userId);
  // Read via admin client (RLS restricts direct SELECT to admins) but scope by caller's org
  const { data, error } = await supabaseAdmin
    .from("whatsapp_instances")
    .select("id, base_url, token, organization_id")
    .eq("id", id)
    .eq("organization_id", organization_id)
    .single();
  if (error || !data) throw new Error("Instância não encontrada");
  return data as { id: string; base_url: string; token: string; organization_id: string };
}

// Safe list for any org member (excludes token + webhook_secret)
export const listInstances = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const organization_id = await getOrgId(supabase, userId);
    const { data, error } = await supabaseAdmin
      .from("whatsapp_instances")
      .select("id, name, base_url, status, phone_number, qr_code, created_at")
      .eq("organization_id", organization_id)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { instances: data ?? [] };
  });

export const connectInstance = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ instanceId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const inst = await getInstance(supabase, context.userId, data.instanceId);
    const r = await uazapiFetch(inst.base_url, inst.token, "/instance/connect", { method: "POST" });
    const qr = (r?.qrcode ?? r?.qrCode ?? r?.qr ?? null) as string | null;
    await supabase
      .from("whatsapp_instances")
      .update({ status: qr ? "connecting" : "connected", qr_code: qr, last_sync_at: new Date().toISOString() })
      .eq("id", data.instanceId);
    return { qr };
  });

export const refreshInstanceStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ instanceId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const inst = await getInstance(supabase, context.userId, data.instanceId);
    const r = await uazapiFetch(inst.base_url, inst.token, "/instance/status", { method: "GET" });
    const connected = Boolean(r?.connected ?? r?.instance?.["connected"]);
    const phone = (r?.phone ?? r?.instance?.["wid"] ?? null) as string | null;
    await supabase
      .from("whatsapp_instances")
      .update({
        status: connected ? "connected" : "disconnected",
        phone_number: phone,
        qr_code: connected ? null : (r?.qrcode as string | null) ?? null,
        last_sync_at: new Date().toISOString(),
      })
      .eq("id", data.instanceId);
    return { connected, phone };
  });

export const disconnectInstance = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ instanceId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const inst = await getInstance(supabase, context.userId, data.instanceId);
    try { await uazapiFetch(inst.base_url, inst.token, "/instance/disconnect", { method: "POST" }); } catch { /* noop */ }
    await supabase.from("whatsapp_instances").update({ status: "disconnected", qr_code: null }).eq("id", data.instanceId);
    return { ok: true };
  });

export const sendWhatsAppMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      instanceId: z.string().uuid(),
      phone: z.string().min(5).max(32),
      text: z.string().min(1).max(4096),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const inst = await getInstance(supabase, context.userId, data.instanceId);

    // Upsert chat
    const { data: chat } = await supabase
      .from("whatsapp_chats")
      .upsert(
        { organization_id: inst.organization_id, instance_id: inst.id, phone: data.phone, last_message_at: new Date().toISOString(), last_message_preview: data.text },
        { onConflict: "instance_id,phone" },
      )
      .select("id")
      .single();
    if (!chat) throw new Error("Falha ao registrar conversa");

    const r = await uazapiFetch(inst.base_url, inst.token, "/send/text", {
      method: "POST",
      body: JSON.stringify({ number: data.phone, text: data.text }),
    });
    const externalId = (r?.id ?? r?.messageId ?? r?.key?.["id"] ?? null) as string | null;

    await supabase.from("whatsapp_messages").insert({
      organization_id: inst.organization_id,
      instance_id: inst.id,
      chat_id: chat.id,
      external_id: externalId,
      direction: "out",
      message_type: "text",
      content: data.text,
      status: "sent",
      sent_by: userId,
    });
    return { ok: true, externalId };
  });

// Admin-only: return the webhook secret for an instance (used to build the webhook URL in the UI)
export const getInstanceWebhookSecret = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ instanceId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const organization_id = await getOrgId(supabase, userId);
    const { data: roles } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("organization_id", organization_id);
    const rs = (roles ?? []).map((r: any) => r.role);
    if (!rs.some((r: string) => r === "owner" || r === "admin")) {
      throw new Error("Apenas owner/admin podem visualizar o segredo do webhook");
    }
    const { data: row, error } = await supabaseAdmin
      .from("whatsapp_instances")
      .select("webhook_secret")
      .eq("id", data.instanceId)
      .eq("organization_id", organization_id)
      .single();
    if (error || !row) throw new Error("Instância não encontrada");
    return { secret: row.webhook_secret as string };
  });

// Marca uma conversa do WhatsApp como venda/convertida e dispara CAPI Purchase
export const markWhatsappConversion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    chatId: z.string().uuid(),
    value: z.number().nonnegative().max(1_000_000).optional(),
    currency: z.string().length(3).default("BRL"),
    status: z.enum(["customer", "lost", "lead"]).default("customer"),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const organization_id = await getOrgId(supabase, userId);

    const { data: chat } = await supabaseAdmin
      .from("whatsapp_chats")
      .select("id, organization_id, phone, first_fbclid, first_gclid, first_landing_url, tracking_session_id")
      .eq("id", data.chatId)
      .single();
    if (!chat || chat.organization_id !== organization_id) throw new Error("Conversa não encontrada");

    const nowIso = new Date().toISOString();
    await supabaseAdmin.from("whatsapp_chats").update({
      conversion_status: data.status,
      conversion_value: data.value ?? null,
      conversion_currency: data.currency,
      converted_at: data.status === "customer" ? nowIso : null,
    }).eq("id", data.chatId);

    if (data.status !== "customer") return { ok: true, dispatched: false };

    const { dispatchMetaCapi, registerGoogleOfflineConversion } = await import("@/lib/attribution.server");
    const meta = await dispatchMetaCapi({
      organizationId: organization_id,
      eventName: "Purchase",
      actionSource: "business_messaging",
      fbclid: chat.first_fbclid,
      phone: chat.phone,
      externalId: chat.tracking_session_id ?? chat.id,
      eventSourceUrl: chat.first_landing_url,
      value: data.value ?? null,
      currency: data.currency,
    });
    await registerGoogleOfflineConversion({
      organizationId: organization_id,
      eventName: "Purchase",
      gclid: chat.first_gclid,
      value: data.value ?? null,
      currency: data.currency,
    });
    return { ok: true, dispatched: true, meta };
  });
