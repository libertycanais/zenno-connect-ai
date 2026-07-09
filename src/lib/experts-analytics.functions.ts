// EPIC E — Intelligence Dashboard aggregations.
// Additive server functions computing widget metrics from persisted
// Recommendations / Playbooks / Evidence. RLS-aware (uses authenticated client).

import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type IntelligenceWidgets = {
  totals: {
    recommendations: number;
    open: number;
    inProgress: number;
    resolved: number;
    dismissed: number;
    archived: number;
    playbooks: number;
    evidence: number;
  };
  financial: {
    estimatedRoiCents: number;
    resolvedValueCents: number;
    openValueCents: number;
  };
  quality: {
    avgConfidence: number;
    avgScore: number;
    criticalCount: number;
    highCount: number;
  };
  timeline: Array<{ date: string; created: number; resolved: number }>;
  topOpen: Array<{
    id: string; summary: string; urgency: string;
    financialValueCents: number; confidence: number; createdAt: string;
  }>;
};

const DAYS = 14;

export const getIntelligenceWidgets = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<IntelligenceWidgets> => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = context.supabase as any;
    const since = new Date(Date.now() - DAYS * 24 * 3600 * 1000).toISOString();

    const [recRes, pbRes, evRes] = await Promise.all([
      sb.from("ai_recommendations")
        .select("id, summary, urgency, status, confidence, financial_value_cents, created_at")
        .order("created_at", { ascending: false }).limit(500),
      sb.from("ai_playbooks").select("id", { count: "exact", head: true }),
      sb.from("ai_evidence").select("id", { count: "exact", head: true }),
    ]);

    type Rec = {
      id: string; summary: string; urgency: string; status: string;
      confidence: number; financial_value_cents: number; created_at: string;
    };
    const recs: Rec[] = (recRes.data ?? []) as Rec[];

    const totals = {
      recommendations: recs.length,
      open: 0, inProgress: 0, resolved: 0, dismissed: 0, archived: 0,
      playbooks: (pbRes.count as number | null) ?? 0,
      evidence: (evRes.count as number | null) ?? 0,
    };
    let sumConf = 0, criticalCount = 0, highCount = 0;
    let openValueCents = 0, resolvedValueCents = 0;

    for (const r of recs) {
      if (r.status === "open") { totals.open++; openValueCents += r.financial_value_cents; }
      else if (r.status === "in_progress") totals.inProgress++;
      else if (r.status === "resolved") { totals.resolved++; resolvedValueCents += r.financial_value_cents; }
      else if (r.status === "dismissed") totals.dismissed++;
      else if (r.status === "archived") totals.archived++;
      sumConf += r.confidence || 0;
      if (r.urgency === "critical") criticalCount++;
      else if (r.urgency === "high") highCount++;
    }

    // Timeline (last DAYS days) — created vs resolved by ISO date.
    const bucket = new Map<string, { created: number; resolved: number }>();
    for (let i = DAYS - 1; i >= 0; i--) {
      const d = new Date(Date.now() - i * 24 * 3600 * 1000).toISOString().slice(0, 10);
      bucket.set(d, { created: 0, resolved: 0 });
    }
    for (const r of recs) {
      if (r.created_at < since) continue;
      const day = r.created_at.slice(0, 10);
      const b = bucket.get(day);
      if (!b) continue;
      b.created++;
      if (r.status === "resolved") b.resolved++;
    }

    const topOpen = recs
      .filter((r) => r.status === "open")
      .sort((a, b) =>
        (b.financial_value_cents - a.financial_value_cents) ||
        (b.confidence - a.confidence))
      .slice(0, 5)
      .map((r) => ({
        id: r.id, summary: r.summary, urgency: r.urgency,
        financialValueCents: r.financial_value_cents,
        confidence: r.confidence, createdAt: r.created_at,
      }));

    return {
      totals,
      financial: {
        estimatedRoiCents: openValueCents + resolvedValueCents,
        resolvedValueCents,
        openValueCents,
      },
      quality: {
        avgConfidence: recs.length ? sumConf / recs.length : 0,
        avgScore: recs.length ? sumConf / recs.length : 0,
        criticalCount,
        highCount,
      },
      timeline: [...bucket.entries()].map(([date, v]) => ({ date, ...v })),
      topOpen,
    };
  });
