import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function getOrgId(supabase: any, userId: string): Promise<string | null> {
  const { data } = await supabase.from("profiles").select("organization_id").eq("id", userId).single();
  return data?.organization_id ?? null;
}

export const getDashboardStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const orgId = await getOrgId(supabase, userId);
    if (!orgId) {
      return empty();
    }

    const since = new Date();
    since.setDate(since.getDate() - 13);
    const sinceIso = since.toISOString();

    const [
      leadsRes,
      recentLeadsRes,
      txRes,
      waRes,
      metaRes,
      googleRes,
      sigmaRes,
      payRes,
      ticketsRes,
    ] = await Promise.all([
      supabase.from("leads").select("status").eq("organization_id", orgId),
      supabase.from("leads").select("created_at,status").eq("organization_id", orgId).gte("created_at", sinceIso),
      supabase.from("finance_transactions").select("type,amount,occurred_at").eq("organization_id", orgId).gte("occurred_at", sinceIso),
      supabase.from("whatsapp_instances").select("id,status").eq("organization_id", orgId),
      supabase.from("meta_ad_accounts").select("id").eq("organization_id", orgId),
      supabase.from("google_ad_accounts").select("id").eq("organization_id", orgId),
      supabase.from("sigma_integrations").select("id,status").eq("organization_id", orgId),
      supabase.from("payment_integrations").select("provider,status").eq("organization_id", orgId),
      supabase.from("tickets").select("id,status").eq("organization_id", orgId),
    ]);

    const leads = leadsRes.data ?? [];
    const counts = {
      total: leads.length,
      novos: leads.filter((l: any) => l.status === "novo").length,
      clientes: leads.filter((l: any) => l.status === "cliente").length,
      renovacoes: leads.filter((l: any) => l.status === "renovacao").length,
      qualificado: leads.filter((l: any) => l.status === "qualificado").length,
      perdido: leads.filter((l: any) => l.status === "perdido").length,
    };

    // 14-day timeline
    const days: { date: string; leads: number; receita: number; despesa: number }[] = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      days.push({ date: key, leads: 0, receita: 0, despesa: 0 });
    }
    const dayIndex = new Map(days.map((d, i) => [d.date, i]));

    (recentLeadsRes.data ?? []).forEach((l: any) => {
      const k = (l.created_at as string).slice(0, 10);
      const i = dayIndex.get(k);
      if (i !== undefined) days[i].leads++;
    });
    (txRes.data ?? []).forEach((t: any) => {
      const k = (t.occurred_at as string).slice(0, 10);
      const i = dayIndex.get(k);
      if (i === undefined) return;
      const amount = Number(t.amount) || 0;
      if (t.type === "receita") days[i].receita += amount;
      else if (t.type === "despesa") days[i].despesa += amount;
    });

    const receitaTotal = days.reduce((s, d) => s + d.receita, 0);
    const despesaTotal = days.reduce((s, d) => s + d.despesa, 0);

    const wa = waRes.data ?? [];
    const sigma = sigmaRes.data ?? [];
    const pay = payRes.data ?? [];

    const integrations = [
      {
        key: "whatsapp",
        label: "WhatsApp",
        connected: wa.some((i: any) => i.status === "connected"),
        count: wa.length,
        href: "/app/whatsapp",
      },
      {
        key: "meta",
        label: "Meta Ads",
        connected: (metaRes.data ?? []).length > 0,
        count: (metaRes.data ?? []).length,
        href: "/app/meta-ads",
      },
      {
        key: "google",
        label: "Google Ads",
        connected: (googleRes.data ?? []).length > 0,
        count: (googleRes.data ?? []).length,
        href: "/app/google-ads",
      },
      {
        key: "sigma",
        label: "Sigma",
        connected: sigma.some((s: any) => s.status === "active"),
        count: sigma.length,
        href: "/app/sigma",
      },
      {
        key: "asaas",
        label: "Asaas",
        connected: pay.some((p: any) => p.provider === "asaas" && p.status === "active"),
        count: pay.filter((p: any) => p.provider === "asaas").length,
        href: "/app/integracoes",
      },
      {
        key: "mercadopago",
        label: "Mercado Pago",
        connected: pay.some((p: any) => p.provider === "mercadopago" && p.status === "active"),
        count: pay.filter((p: any) => p.provider === "mercadopago").length,
        href: "/app/integracoes",
      },
    ];

    const tickets = ticketsRes.data ?? [];

    return {
      counts,
      finance: { receita: receitaTotal, despesa: despesaTotal, saldo: receitaTotal - despesaTotal },
      days,
      integrations,
      tickets: {
        total: tickets.length,
        abertos: tickets.filter((t: any) => t.status === "open" || t.status === "aberto").length,
      },
    };
  });

function empty() {
  return {
    counts: { total: 0, novos: 0, clientes: 0, renovacoes: 0, qualificado: 0, perdido: 0 },
    finance: { receita: 0, despesa: 0, saldo: 0 },
    days: [] as { date: string; leads: number; receita: number; despesa: number }[],
    integrations: [] as { key: string; label: string; connected: boolean; count: number; href: string }[],
    tickets: { total: 0, abertos: 0 },
  };
}
