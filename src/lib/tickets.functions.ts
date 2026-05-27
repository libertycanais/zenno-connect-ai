import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const Status = z.enum(["open", "pending", "resolved", "closed"]);
const Priority = z.enum(["low", "normal", "high", "urgent"]);

async function getOrgId(supabase: any, userId: string) {
  const { data } = await supabase.from("profiles").select("organization_id").eq("id", userId).single();
  if (!data) throw new Error("Perfil não encontrado");
  return data.organization_id as string;
}

// ============ Tickets ============
export const listTickets = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("tickets")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { tickets: data ?? [] };
  });

export const getTicket = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: ticket, error: e1 } = await supabase.from("tickets").select("*").eq("id", data.id).single();
    if (e1) throw new Error(e1.message);
    const { data: messages, error: e2 } = await supabase
      .from("ticket_messages")
      .select("*")
      .eq("ticket_id", data.id)
      .order("created_at", { ascending: true });
    if (e2) throw new Error(e2.message);
    return { ticket, messages: messages ?? [] };
  });

export const createTicket = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      subject: z.string().min(1).max(200),
      description: z.string().max(5000).optional(),
      priority: Priority.default("normal"),
      channel: z.string().max(50).optional(),
      requester_name: z.string().max(120).optional(),
      requester_email: z.string().email().optional().or(z.literal("")),
      requester_phone: z.string().max(30).optional(),
      lead_id: z.string().uuid().optional(),
      assigned_to: z.string().uuid().optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const organization_id = await getOrgId(supabase, userId);
    const payload: any = {
      ...data,
      organization_id,
      created_by: userId,
      status: "open",
    };
    if (!payload.requester_email) delete payload.requester_email;
    const { data: row, error } = await supabase.from("tickets").insert(payload).select().single();
    if (error) throw new Error(error.message);
    return { ticket: row };
  });

export const updateTicket = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      id: z.string().uuid(),
      status: Status.optional(),
      priority: Priority.optional(),
      assigned_to: z.string().uuid().nullable().optional(),
      subject: z.string().min(1).max(200).optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const patch: any = { ...data };
    delete patch.id;
    if (data.status === "closed" || data.status === "resolved") {
      patch.closed_at = new Date().toISOString();
    } else if (data.status === "open" || data.status === "pending") {
      patch.closed_at = null;
    }
    const { error } = await context.supabase.from("tickets").update(patch).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteTicket = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("tickets").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ============ Messages ============
export const addTicketMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      ticket_id: z.string().uuid(),
      body: z.string().min(1).max(10000),
      is_internal: z.boolean().default(false),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const organization_id = await getOrgId(supabase, userId);
    const { data: row, error } = await supabase
      .from("ticket_messages")
      .insert({
        ticket_id: data.ticket_id,
        body: data.body,
        is_internal: data.is_internal,
        author_id: userId,
        organization_id,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    // Bump ticket updated_at
    await supabase.from("tickets").update({ updated_at: new Date().toISOString() }).eq("id", data.ticket_id);
    return { message: row };
  });

export const getTicketStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase.from("tickets").select("status, priority");
    if (error) throw new Error(error.message);
    const rows = data ?? [];
    return {
      total: rows.length,
      open: rows.filter((r: any) => r.status === "open").length,
      pending: rows.filter((r: any) => r.status === "pending").length,
      resolved: rows.filter((r: any) => r.status === "resolved").length,
      closed: rows.filter((r: any) => r.status === "closed").length,
      urgent: rows.filter((r: any) => r.priority === "urgent").length,
    };
  });
