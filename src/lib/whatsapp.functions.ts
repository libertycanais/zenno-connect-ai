import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Thin proxy to Uazapi (or any compatible WhatsApp HTTP API).
// All credentials live in the DB row (RLS-scoped per organization).

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
  let data: unknown;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!res.ok) throw new Error(`Uazapi ${res.status}: ${typeof data === "string" ? data : JSON.stringify(data)}`);
  return data as Record<string, unknown> | null;
}

type AnyRec = Record<string, any>;

async function getInstance(supabase: any, id: string) {
  const { data, error } = await supabase
    .from("whatsapp_instances")
    .select("id, base_url, token, organization_id")
    .eq("id", id)
    .single();
  if (error || !data) throw new Error("Instância não encontrada");
  return data as { id: string; base_url: string; token: string; organization_id: string };
}

export const connectInstance = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ instanceId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const inst = await getInstance(supabase, data.instanceId);
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
    const inst = await getInstance(supabase, data.instanceId);
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
    const inst = await getInstance(supabase, data.instanceId);
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
    const inst = await getInstance(supabase, data.instanceId);

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
