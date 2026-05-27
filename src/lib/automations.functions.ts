import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// ---------- Schemas ----------
const TriggerType = z.enum([
  "lead.created",
  "lead.status_changed",
  "finance.overdue",
  "whatsapp.message_received",
  "manual",
]);

const ActionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("send_whatsapp"), instance_id: z.string().uuid(), phone_template: z.string().min(1), message_template: z.string().min(1) }),
  z.object({ type: z.literal("create_activity"), activity_type: z.string().min(1).max(40), content_template: z.string().min(1) }),
  z.object({ type: z.literal("create_transaction"), kind: z.enum(["income", "expense"]), description_template: z.string().min(1), amount: z.number().positive(), due_days: z.number().int().min(0).max(365).default(0) }),
  z.object({ type: z.literal("webhook"), url: z.string().url(), headers: z.record(z.string(), z.string()).optional() }),
]);

const TriggerConfig = z.object({
  from_status: z.string().optional(),
  to_status: z.string().optional(),
}).default({});

const AutomationInput = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(500).optional().nullable(),
  trigger_type: TriggerType,
  trigger_config: TriggerConfig.optional(),
  actions: z.array(ActionSchema).min(1).max(10),
  is_active: z.boolean().default(true),
});

export type AutomationAction = z.infer<typeof ActionSchema>;

// ---------- Helpers ----------
function interpolate(tpl: string, ctx: Record<string, unknown>): string {
  return tpl.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, key: string) => {
    const parts = key.split(".");
    let cur: unknown = ctx;
    for (const p of parts) {
      if (cur && typeof cur === "object" && p in (cur as Record<string, unknown>)) {
        cur = (cur as Record<string, unknown>)[p];
      } else { return ""; }
    }
    return cur == null ? "" : String(cur);
  });
}

// ---------- CRUD ----------
export const listAutomations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("automations")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { automations: data ?? [] };
  });

export const upsertAutomation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid().optional(), data: AutomationInput }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (data.id) {
      const { error } = await supabase
        .from("automations")
        .update({
          name: data.data.name,
          description: data.data.description ?? null,
          trigger_type: data.data.trigger_type,
          trigger_config: data.data.trigger_config ?? {},
          actions: data.data.actions,
          is_active: data.data.is_active,
        })
        .eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: prof } = await supabase.from("profiles").select("organization_id").eq("id", userId).single();
    if (!prof) throw new Error("Perfil não encontrado");
    const { data: row, error } = await supabase
      .from("automations")
      .insert({
        organization_id: prof.organization_id,
        name: data.data.name,
        description: data.data.description ?? null,
        trigger_type: data.data.trigger_type,
        trigger_config: data.data.trigger_config ?? {},
        actions: data.data.actions,
        is_active: data.data.is_active,
        created_by: userId,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id };
  });

export const toggleAutomation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid(), is_active: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("automations").update({ is_active: data.is_active }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteAutomation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("automations").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listRuns = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ automation_id: z.string().uuid().optional() }).parse(d ?? {}))
  .handler(async ({ data, context }) => {
    let q = context.supabase.from("automation_runs").select("*").order("created_at", { ascending: false }).limit(100);
    if (data.automation_id) q = q.eq("automation_id", data.automation_id);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return { runs: rows ?? [] };
  });

// ---------- Executor (admin – chamado pelos triggers) ----------
export async function dispatchEvent(opts: {
  organizationId: string;
  triggerType: z.infer<typeof TriggerType>;
  payload: Record<string, unknown>;
}) {
  const { data: rules, error } = await supabaseAdmin
    .from("automations")
    .select("*")
    .eq("organization_id", opts.organizationId)
    .eq("trigger_type", opts.triggerType)
    .eq("is_active", true);
  if (error || !rules?.length) return { matched: 0 };

  let matched = 0;
  for (const rule of rules) {
    const cfg = (rule.trigger_config ?? {}) as Record<string, string | undefined>;
    if (opts.triggerType === "lead.status_changed") {
      if (cfg.from_status && opts.payload.from_status !== cfg.from_status) continue;
      if (cfg.to_status && opts.payload.to_status !== cfg.to_status) continue;
    }
    matched++;
    const results: Array<{ action: string; ok: boolean; error?: string }> = [];
    let runStatus: "success" | "partial" | "error" = "success";
    let runError: string | null = null;

    const actions = (rule.actions ?? []) as AutomationAction[];
    for (const action of actions) {
      try {
        await runAction(action, opts.organizationId, opts.payload);
        results.push({ action: action.type, ok: true });
      } catch (e) {
        results.push({ action: action.type, ok: false, error: (e as Error).message });
        runStatus = runStatus === "success" ? "partial" : "error";
        runError = (e as Error).message;
      }
    }
    if (results.length && results.every((r) => !r.ok)) runStatus = "error";

    await supabaseAdmin.from("automation_runs").insert({
      organization_id: opts.organizationId,
      automation_id: rule.id,
      trigger_payload: opts.payload as never,
      status: runStatus,
      actions_result: results,
      error: runError,
    });
  }
  return { matched };
}

async function runAction(action: AutomationAction, orgId: string, ctx: Record<string, unknown>) {
  switch (action.type) {
    case "send_whatsapp": {
      const phone = interpolate(action.phone_template, ctx);
      const message = interpolate(action.message_template, ctx);
      if (!phone || !message) throw new Error("Telefone ou mensagem vazios após interpolação");
      const { data: inst, error } = await supabaseAdmin
        .from("whatsapp_instances")
        .select("base_url,token,instance_id,organization_id")
        .eq("id", action.instance_id)
        .single();
      if (error || !inst) throw new Error("Instância WhatsApp não encontrada");
      if (inst.organization_id !== orgId) throw new Error("Instância de outra organização");
      const res = await fetch(`${inst.base_url.replace(/\/$/, "")}/send/text`, {
        method: "POST",
        headers: { "Content-Type": "application/json", token: inst.token },
        body: JSON.stringify({ number: phone, text: message }),
      });
      if (!res.ok) throw new Error(`uazapi ${res.status}`);
      return;
    }
    case "create_activity": {
      const leadId = ctx.lead_id as string | undefined;
      if (!leadId) throw new Error("lead_id ausente no contexto");
      const { error } = await supabaseAdmin.from("lead_activities").insert({
        organization_id: orgId,
        lead_id: leadId,
        activity_type: action.activity_type,
        content: interpolate(action.content_template, ctx),
      });
      if (error) throw new Error(error.message);
      return;
    }
    case "create_transaction": {
      const due = new Date();
      due.setDate(due.getDate() + action.due_days);
      const { error } = await supabaseAdmin.from("finance_transactions").insert({
        organization_id: orgId,
        kind: action.kind,
        description: interpolate(action.description_template, ctx),
        amount: action.amount,
        currency: "BRL",
        due_date: due.toISOString().slice(0, 10),
        status: "pending",
        lead_id: (ctx.lead_id as string | undefined) ?? null,
      });
      if (error) throw new Error(error.message);
      return;
    }
    case "webhook": {
      const res = await fetch(action.url, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(action.headers ?? {}) },
        body: JSON.stringify({ event_payload: ctx, source: "zenno-automations" }),
      });
      if (!res.ok) throw new Error(`webhook ${res.status}`);
      return;
    }
  }
}

// Disparo manual para teste
export const runAutomationManually = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid(), payload: z.record(z.string(), z.unknown()).default({}) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: prof } = await context.supabase.from("profiles").select("organization_id").eq("id", context.userId).single();
    if (!prof) throw new Error("Perfil não encontrado");
    const { data: rule } = await supabaseAdmin.from("automations").select("*").eq("id", data.id).single();
    if (!rule || rule.organization_id !== prof.organization_id) throw new Error("Automação não encontrada");
    const results: Array<{ action: string; ok: boolean; error?: string }> = [];
    for (const action of (rule.actions ?? []) as AutomationAction[]) {
      try { await runAction(action, prof.organization_id, data.payload); results.push({ action: action.type, ok: true }); }
      catch (e) { results.push({ action: action.type, ok: false, error: (e as Error).message }); }
    }
    const ok = results.every((r) => r.ok);
    await supabaseAdmin.from("automation_runs").insert({
      organization_id: prof.organization_id,
      automation_id: data.id,
      trigger_payload: data.payload as never,
      status: ok ? "success" : (results.some((r) => r.ok) ? "partial" : "error"),
      actions_result: results,
    });
    return { results };
  });
