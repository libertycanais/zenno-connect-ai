// FEATURE P0.5 — Executive Analytics Dashboard
// Server functions com queries agregadas (evita N+1) e RLS-aware.
// Toda leitura respeita a policy da tabela; não usa service_role.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  buildDailySeries,
  buildFunnel,
  computeAcquisitionKPIs,
  computeBillingKPIs,
  computeUnitEconomics,
  groupBySource,
  toCSV,
  toExcelXML,
  type ConversionLite,
  type FinanceLite,
  type LeadLite,
  type SubscriptionLite,
} from "./executive-dashboard.helpers";

const rangeSchema = z.object({
  days: z.number().int().min(1).max(365).default(30),
});

export type ExecutiveSnapshot = {
  range: { days: number; since: string; now: string };
  billing: ReturnType<typeof computeBillingKPIs>;
  acquisition: ReturnType<typeof computeAcquisitionKPIs>;
  economics: ReturnType<typeof computeUnitEconomics>;
  funnel: ReturnType<typeof buildFunnel>;
  daily: ReturnType<typeof buildDailySeries>;
  sources: ReturnType<typeof groupBySource>;
  organization: {
    members: number;
    pending_invitations: number;
  };
};

export const getExecutiveSnapshot = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) =>
    rangeSchema.parse(raw && typeof raw === "object" ? raw : { days: 30 }),
  )
  .handler(async ({ data, context }): Promise<ExecutiveSnapshot> => {
    const now = new Date();
    const since = new Date(now.getTime() - data.days * 24 * 3600 * 1000);
    const sinceIso = since.toISOString();

    const sb = context.supabase as any;

    // Consultas paralelas — RLS filtra por organização automaticamente.
    const [subsRes, leadsRes, convRes, finRes, membersRes, invitesRes] =
      await Promise.all([
        sb.from("subscriptions")
          .select("id, status, plan, price_cents, created_at, canceled_at, current_period_end, trial_ends_at"),
        sb.from("leads")
          .select("status, created_at, utm_source, utm_medium")
          .gte("created_at", sinceIso),
        sb.from("meta_conversion_events")
          .select("event_name, value, created_at")
          .gte("created_at", sinceIso),
        sb.from("finance_transactions")
          .select("kind, amount, due_date")
          .gte("due_date", since.toISOString().slice(0, 10)),
        sb.from("profiles").select("id"),
        sb.from("organization_invitations")
          .select("id")
          .eq("status", "pending"),
      ]);

    const subs = (subsRes.data ?? []) as SubscriptionLite[];
    const leads = (leadsRes.data ?? []) as LeadLite[];
    const conversions = (convRes.data ?? []) as ConversionLite[];
    const finance = (finRes.data ?? []) as FinanceLite[];

    const billing = computeBillingKPIs(subs, now);
    const acquisition = computeAcquisitionKPIs(leads);

    // Marketing spend = despesas do período (proxy). ROI/CAC calculados só se houver dado.
    const marketingSpend = finance
      .filter((t) => t.kind === "expense")
      .reduce((s, t) => s + (Number(t.amount) || 0), 0);
    const economics = computeUnitEconomics({
      marketingSpend,
      newCustomers: acquisition.clientes,
      ticketMedio: billing.ticketMedio,
      churnRate: billing.churnRate,
    });

    return {
      range: { days: data.days, since: sinceIso, now: now.toISOString() },
      billing,
      acquisition,
      economics,
      funnel: buildFunnel(leads),
      daily: buildDailySeries(data.days, { leads, conversions, finance }, now),
      sources: groupBySource(leads),
      organization: {
        members: (membersRes.data ?? []).length,
        pending_invitations: (invitesRes.data ?? []).length,
      },
    };
  });

// -------- Exportações --------

const exportSchema = z.object({
  format: z.enum(["csv", "xlsx", "json"]).default("csv"),
  days: z.number().int().min(1).max(365).default(30),
});

export const exportExecutiveReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => exportSchema.parse(raw))
  .handler(async ({ data, context }) => {
    const snap = await getExecutiveSnapshot({ data: { days: data.days } as never });
    // Reduz snapshot a linhas planas (uma linha por dia).
    const rows = snap.daily.map((d) => ({
      date: d.date,
      leads: d.leads,
      conversions: d.conversions,
      revenue: d.revenue,
      mrr: snap.billing.mrr,
      arr: snap.billing.arr,
      churn_rate: snap.billing.churnRate,
      ticket_medio: snap.billing.ticketMedio,
      cac: snap.economics.cac,
      ltv: snap.economics.ltv,
      roi: snap.economics.roi,
    }));
    void context;
    if (data.format === "csv") {
      return { filename: `executive-${data.days}d.csv`, mime: "text/csv", content: toCSV(rows) };
    }
    if (data.format === "xlsx") {
      return {
        filename: `executive-${data.days}d.xml`,
        mime: "application/vnd.ms-excel",
        content: toExcelXML(rows),
      };
    }
    return {
      filename: `executive-${data.days}d.json`,
      mime: "application/json",
      content: JSON.stringify(snap, null, 2),
    };
  });
