import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

async function getOrgId(supabase: any, userId: string) {
  const { data } = await supabase.from("profiles").select("organization_id").eq("id", userId).single();
  if (!data) throw new Error("Perfil não encontrado");
  return data.organization_id as string;
}

export type AttributedChat = {
  id: string;
  created_at: string;
  name: string | null;
  phone: string;
  first_utm_source: string | null;
  first_utm_campaign: string | null;
  first_utm_content: string | null;
  first_utm_term: string | null;
  first_fbclid: string | null;
  first_gclid: string | null;
  attributed_at: string | null;
  conversion_status: string;
  conversion_value: number | null;
  conversion_currency: string | null;
  converted_at: string | null;
  last_message_preview: string | null;
  last_message_at: string | null;
  payment_mode: string | null;
  due_at: string | null;
};

export const listAttributedChats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const organization_id = await getOrgId(context.supabase, context.userId);
    const { data, error } = await supabaseAdmin
      .from("whatsapp_chats")
      .select(
        "id, created_at, name, phone, first_utm_source, first_utm_campaign, first_utm_content, first_utm_term, first_fbclid, first_gclid, attributed_at, conversion_status, conversion_value, conversion_currency, converted_at, last_message_preview, last_message_at, payment_mode, due_at",
      )
      .eq("organization_id", organization_id)
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) throw new Error(error.message);
    return { chats: (data ?? []) as AttributedChat[] };
  });

export const convertChat = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { chatId: string; value: number; currency?: string }) =>
    z.object({
      chatId: z.string().uuid(),
      value: z.number().min(0).max(1_000_000),
      currency: z.string().length(3).optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const organization_id = await getOrgId(context.supabase, context.userId);
    const { data: chat, error } = await supabaseAdmin
      .from("whatsapp_chats")
      .select("id, organization_id, phone, first_fbclid, first_gclid, first_landing_url, tracking_session_id, conversion_status")
      .eq("id", data.chatId)
      .eq("organization_id", organization_id)
      .maybeSingle();
    if (error || !chat) throw new Error("Conversa não encontrada");
    if (chat.conversion_status === "converted") throw new Error("Já convertida");

    const currency = data.currency ?? "BRL";
    const { dispatchMetaCapi, registerGoogleOfflineConversion } = await import("@/lib/attribution.server");
    const meta = await dispatchMetaCapi({
      organizationId: organization_id,
      eventName: "Purchase",
      actionSource: "business_messaging",
      fbclid: chat.first_fbclid,
      phone: chat.phone,
      value: data.value,
      currency,
      externalId: chat.tracking_session_id ?? chat.id,
      eventSourceUrl: chat.first_landing_url,
    }).catch((e) => ({ error: String(e) }));

    const google = await registerGoogleOfflineConversion({
      organizationId: organization_id,
      eventName: "Purchase",
      gclid: chat.first_gclid,
      value: data.value,
      currency,
    }).catch((e) => ({ error: String(e) }));

    await supabaseAdmin
      .from("whatsapp_chats")
      .update({
        conversion_status: "converted",
        conversion_value: data.value,
        conversion_currency: currency,
        converted_at: new Date().toISOString(),
      })
      .eq("id", chat.id);

    return { ok: true, meta, google };
  });

export const rejectChatConversion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { chatId: string }) => z.object({ chatId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const organization_id = await getOrgId(context.supabase, context.userId);
    const { error } = await supabaseAdmin
      .from("whatsapp_chats")
      .update({ conversion_status: "rejected" })
      .eq("id", data.chatId)
      .eq("organization_id", organization_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
