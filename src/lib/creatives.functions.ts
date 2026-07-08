import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

async function getOrgId(supabase: any, userId: string) {
  const { data } = await supabase.from("profiles").select("organization_id").eq("id", userId).single();
  if (!data) throw new Error("Perfil não encontrado");
  return data.organization_id as string;
}

export type CreativeRow = {
  key: string;                 // ad_id ou utm_content
  ad_id: string | null;
  ad_name: string | null;
  campaign_name: string | null;
  adset_name: string | null;
  spend: number;
  impressions: number;
  clicks: number;
  leads: number;               // chats atribuídos
  sales: number;               // chats convertidos
  revenue: number;
  cpl: number | null;          // custo por lead
  cpa: number | null;          // custo por venda
  roas: number | null;
};

export const listCreatives = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const orgId = await getOrgId(context.supabase, context.userId);

    // 1) Insights: agrupar por ad_id (fallback ad_name / campaign_name)
    const { data: insights } = await supabaseAdmin
      .from("meta_ads_insights")
      .select("ad_id, ad_name, adset_name, campaign_name, spend, impressions, clicks")
      .eq("organization_id", orgId)
      .limit(5000);

    const byKey = new Map<string, CreativeRow>();
    for (const r of insights ?? []) {
      const key = r.ad_id ?? r.ad_name ?? r.campaign_name ?? "unknown";
      const cur = byKey.get(key) ?? {
        key, ad_id: r.ad_id ?? null, ad_name: r.ad_name ?? null,
        campaign_name: r.campaign_name ?? null, adset_name: r.adset_name ?? null,
        spend: 0, impressions: 0, clicks: 0, leads: 0, sales: 0, revenue: 0,
        cpl: null, cpa: null, roas: null,
      };
      cur.spend += Number(r.spend ?? 0);
      cur.impressions += Number(r.impressions ?? 0);
      cur.clicks += Number(r.clicks ?? 0);
      byKey.set(key, cur);
    }

    // 2) Chats atribuídos: agrupar por utm_content (o link CTWA carrega utm_content = ad_id ou ad_name)
    const { data: chats } = await supabaseAdmin
      .from("whatsapp_chats")
      .select("first_utm_content, conversion_status, conversion_value")
      .eq("organization_id", orgId)
      .not("first_utm_content", "is", null);

    for (const c of chats ?? []) {
      const key = c.first_utm_content ?? "unknown";
      const cur = byKey.get(key) ?? {
        key, ad_id: null, ad_name: key, campaign_name: null, adset_name: null,
        spend: 0, impressions: 0, clicks: 0, leads: 0, sales: 0, revenue: 0,
        cpl: null, cpa: null, roas: null,
      };
      cur.leads += 1;
      if (c.conversion_status === "converted") {
        cur.sales += 1;
        cur.revenue += Number(c.conversion_value ?? 0);
      }
      byKey.set(key, cur);
    }

    const rows = [...byKey.values()].map((r) => ({
      ...r,
      cpl: r.leads > 0 ? r.spend / r.leads : null,
      cpa: r.sales > 0 ? r.spend / r.sales : null,
      roas: r.spend > 0 ? r.revenue / r.spend : null,
    })).sort((a, b) => b.spend - a.spend);

    return { rows };
  });
