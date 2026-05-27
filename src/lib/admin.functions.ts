import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

async function ensureAdmin(supabase: any, userId: string) {
  const { data: profile } = await supabase.from("profiles").select("organization_id").eq("id", userId).single();
  if (!profile) throw new Error("Perfil não encontrado");
  const orgId = profile.organization_id as string;
  const { data: roles } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("organization_id", orgId);
  const allowed = (roles ?? []).some((r: any) => r.role === "owner" || r.role === "admin");
  if (!allowed) throw new Error("Acesso restrito a owner/admin");
  return orgId;
}

export const getSystemHealth = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const orgId = await ensureAdmin(supabase, userId);
    const db = supabaseAdmin;

    const now = Date.now();
    const dayAgo = new Date(now - 24 * 3600 * 1000).toISOString();
    const weekAgo = new Date(now - 7 * 24 * 3600 * 1000).toISOString();

    const countOf = async (table: string, extra?: (q: any) => any) => {
      let q = db.from(table).select("*", { count: "exact", head: true }).eq("organization_id", orgId);
      if (extra) q = extra(q);
      const { count, error } = await q;
      if (error) return { count: 0, error: error.message };
      return { count: count ?? 0 };
    };

    const [
      leads, leads24h, tickets, openTickets,
      waInstances, metaAccounts, googleAccounts, sigmaIntegrations,
      automations, automationRuns24h,
    ] = await Promise.all([
      countOf("leads"),
      countOf("leads", (q) => q.gte("created_at", dayAgo)),
      countOf("tickets"),
      countOf("tickets", (q) => q.in("status", ["open", "pending"])),
      countOf("whatsapp_instances"),
      countOf("meta_ad_accounts"),
      countOf("google_ad_accounts"),
      countOf("sigma_integrations"),
      countOf("automations"),
      countOf("automation_runs", (q) => q.gte("created_at", dayAgo)),
    ]);

    // Detalhes de integrações
    const { data: waList } = await db
      .from("whatsapp_instances")
      .select("id, name, status, phone_number, last_sync_at, updated_at")
      .eq("organization_id", orgId)
      .order("updated_at", { ascending: false });

    const { data: metaList } = await db
      .from("meta_ad_accounts")
      .select("id, name, ad_account_id, status, token_expires_at, updated_at")
      .eq("organization_id", orgId)
      .order("updated_at", { ascending: false });

    const { data: googleList } = await db
      .from("google_ad_accounts")
      .select("id, name, customer_id, status, token_expires_at, updated_at")
      .eq("organization_id", orgId)
      .order("updated_at", { ascending: false });

    const { data: sigmaList } = await db
      .from("sigma_integrations")
      .select("id, name, status, base_url, updated_at")
      .eq("organization_id", orgId)
      .order("updated_at", { ascending: false });

    // Falhas recentes
    const { data: failedRuns } = await db
      .from("automation_runs")
      .select("id, automation_id, status, error, created_at")
      .eq("organization_id", orgId)
      .eq("status", "error")
      .gte("created_at", weekAgo)
      .order("created_at", { ascending: false })
      .limit(20);

    const { data: sigmaErrors } = await db
      .from("sigma_requests")
      .select("id, integration_id, endpoint, response_status, error, created_at")
      .eq("organization_id", orgId)
      .gte("created_at", weekAgo)
      .or("error.not.is.null,response_status.gte.400")
      .order("created_at", { ascending: false })
      .limit(20);

    const { data: metaErrors } = await db
      .from("meta_conversion_events")
      .select("id, event_name, status, error, created_at")
      .eq("organization_id", orgId)
      .eq("status", "error")
      .gte("created_at", weekAgo)
      .order("created_at", { ascending: false })
      .limit(10);

    const { data: gadsErrors } = await db
      .from("google_ads_conversions")
      .select("id, conversion_action, status, error, created_at")
      .eq("organization_id", orgId)
      .eq("status", "error")
      .gte("created_at", weekAgo)
      .order("created_at", { ascending: false })
      .limit(10);

    // Avaliação de saúde por categoria
    const tokenExpiring = (iso: string | null) => {
      if (!iso) return "unknown";
      const t = new Date(iso).getTime();
      if (t < now) return "expired";
      if (t - now < 7 * 24 * 3600 * 1000) return "warning";
      return "ok";
    };

    const integrations = {
      whatsapp: (waList ?? []).map((w) => ({
        ...w,
        health: w.status === "connected" ? "ok" : w.status === "connecting" ? "warning" : "error",
      })),
      meta: (metaList ?? []).map((m) => ({
        ...m,
        token_health: tokenExpiring(m.token_expires_at as any),
        health: m.status === "active" ? "ok" : "error",
      })),
      google: (googleList ?? []).map((g) => ({
        ...g,
        token_health: tokenExpiring(g.token_expires_at as any),
        health: g.status === "active" ? "ok" : "error",
      })),
      sigma: (sigmaList ?? []).map((s) => ({
        ...s,
        health: s.status === "active" ? "ok" : "error",
      })),
    };

    const summary = {
      leads: leads.count,
      leads_24h: leads24h.count,
      tickets: tickets.count,
      open_tickets: openTickets.count,
      wa_instances: waInstances.count,
      meta_accounts: metaAccounts.count,
      google_accounts: googleAccounts.count,
      sigma_integrations: sigmaIntegrations.count,
      automations: automations.count,
      automation_runs_24h: automationRuns24h.count,
      failed_runs_7d: (failedRuns ?? []).length,
      sigma_errors_7d: (sigmaErrors ?? []).length,
      meta_errors_7d: (metaErrors ?? []).length,
      gads_errors_7d: (gadsErrors ?? []).length,
    };

    return {
      summary,
      integrations,
      errors: {
        automations: failedRuns ?? [],
        sigma: sigmaErrors ?? [],
        meta: metaErrors ?? [],
        google: gadsErrors ?? [],
      },
      generated_at: new Date().toISOString(),
    };
  });
