import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

async function getOrgId(supabase: any, userId: string) {
  const { data } = await supabase.from("profiles").select("organization_id").eq("id", userId).single();
  if (!data) throw new Error("Perfil não encontrado");
  return data.organization_id as string;
}

export type ChargeRow = {
  id: string;
  name: string | null;
  phone: string;
  payment_mode: string | null;
  due_at: string | null;
  conversion_value: number | null;
  last_message_preview: string | null;
  overdue: boolean;
};

export const listChargesDue = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const orgId = await getOrgId(context.supabase, context.userId);
    const in24h = new Date(Date.now() + 24 * 3600 * 1000).toISOString();
    const { data, error } = await supabaseAdmin
      .from("whatsapp_chats")
      .select("id, name, phone, payment_mode, due_at, conversion_value, last_message_preview, reminder_sent_at, conversion_status")
      .eq("organization_id", orgId)
      .eq("conversion_status", "pending")
      .is("reminder_sent_at", null)
      .not("due_at", "is", null)
      .lte("due_at", in24h)
      .order("due_at", { ascending: true })
      .limit(200);
    if (error) throw new Error(error.message);
    const now = Date.now();
    const rows: ChargeRow[] = (data ?? []).map((r) => ({
      id: r.id,
      name: r.name,
      phone: r.phone,
      payment_mode: r.payment_mode,
      due_at: r.due_at,
      conversion_value: r.conversion_value,
      last_message_preview: r.last_message_preview,
      overdue: r.due_at ? new Date(r.due_at).getTime() < now : false,
    }));
    return { rows };
  });

export const markReminderSent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { chatId: string }) => z.object({ chatId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const orgId = await getOrgId(context.supabase, context.userId);
    const { error } = await supabaseAdmin
      .from("whatsapp_chats")
      .update({ reminder_sent_at: new Date().toISOString() })
      .eq("id", data.chatId)
      .eq("organization_id", orgId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const updateChatPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { chatId: string; payment_mode?: "upfront" | "cod" | "postpaid" | null; due_at?: string | null }) =>
    z.object({
      chatId: z.string().uuid(),
      payment_mode: z.enum(["upfront", "cod", "postpaid"]).nullable().optional(),
      due_at: z.string().nullable().optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const orgId = await getOrgId(context.supabase, context.userId);
    const patch: Record<string, unknown> = {};
    if (data.payment_mode !== undefined) patch.payment_mode = data.payment_mode;
    if (data.due_at !== undefined) patch.due_at = data.due_at;
    if (data.due_at !== undefined) patch.reminder_sent_at = null; // reagenda lembrete
    const { error } = await supabaseAdmin
      .from("whatsapp_chats")
      .update(patch)
      .eq("id", data.chatId)
      .eq("organization_id", orgId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
