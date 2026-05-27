import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const Plan = z.enum(["trial", "basico", "completo", "cancelado"]);

async function getOrgId(supabase: any, userId: string): Promise<string> {
  const { data } = await supabase.from("profiles").select("organization_id").eq("id", userId).single();
  if (!data?.organization_id) throw new Error("Organização não encontrada");
  return data.organization_id as string;
}

export const getSubscription = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const orgId = await getOrgId(supabase, userId);
    let { data } = await supabase.from("subscriptions").select("*").eq("organization_id", orgId).maybeSingle();
    if (!data) {
      const ins = await supabaseAdmin
        .from("subscriptions")
        .insert({ organization_id: orgId, plan: "trial", status: "trialing" })
        .select("*")
        .single();
      data = ins.data as any;
    }
    return { subscription: data };
  });

export const changePlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { plan: string }) => z.object({ plan: Plan }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const orgId = await getOrgId(supabase, userId);
    const price = data.plan === "basico" ? 2999 : data.plan === "completo" ? 6999 : 0;
    const status = data.plan === "cancelado" ? "cancelled" : data.plan === "trial" ? "trialing" : "active";
    const period_end =
      data.plan === "basico" || data.plan === "completo"
        ? new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString()
        : null;
    const { data: row, error } = await supabaseAdmin
      .from("subscriptions")
      .update({ plan: data.plan, price_cents: price, status, current_period_end: period_end })
      .eq("organization_id", orgId)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return { subscription: row };
  });
