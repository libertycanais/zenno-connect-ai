// RC2 Operational Enhancements — server functions for pilot operations.
// All handlers use `requireSupabaseAuth`, so RLS applies and every read is
// scoped to the caller's organization via `current_org_id()`. No cross-tenant
// aggregation is possible from the client; multi-org rollups happen server-side
// under the caller's RLS context only.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { sanitizeProps, PILOT_EVENTS } from "@/lib/pilot/telemetry";
import { scoreBacklogItem, type BacklogEvidence } from "@/lib/pilot/backlog";

// ---------- Daily dashboard aggregation (server-side only) ----------

export const getPilotDailyDashboard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const since14d = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();

    const [
      { data: events, error: eventsErr },
      { data: orgs },
      { data: feedback },
      { data: copilotFeedback },
      { data: recos },
      { data: widgets },
      { data: flags },
      { data: aiUsage },
      { data: rateHits },
    ] = await Promise.all([
      supabase.from("pilot_telemetry_events")
        .select("event_name, category, latency_ms, user_id, occurred_at, props")
        .gte("occurred_at", since14d)
        .limit(5000),
      supabase.from("pilot_organizations")
        .select("organization_id, cohort, status, health_score, adoption_score, ttfv_seconds"),
      supabase.from("pilot_feedback")
        .select("kind, score, sentiment, created_at").gte("created_at", since14d),
      supabase.from("pilot_copilot_feedback")
        .select("reaction, latency_ms, created_at").gte("created_at", since14d),
      supabase.from("ai_recommendations")
        .select("status, created_at").gte("created_at", since14d).limit(1000),
      supabase.from("workspace_widgets")
        .select("widget_type, created_at").limit(1000),
      supabase.from("workspace_feature_flags")
        .select("flag, enabled, rollout, scope"),
      supabase.from("ai_usage")
        .select("provider, cost_cents, tokens_in, tokens_out, created_at").gte("created_at", since14d).limit(2000),
      supabase.from("pilot_telemetry_rate_hits")
        .select("blocked_count, bucket").gte("bucket", since14d),
    ]);

    if (eventsErr) throw new Error(eventsErr.message);
    const evs = events ?? [];
    const last24 = evs.filter((e) => new Date(e.occurred_at as string) >= new Date(since));

    // Active users / sessions (unique user_id in 24h)
    const activeUsers = new Set(last24.map((e) => e.user_id).filter(Boolean)).size;
    const sessions = last24.filter((e) => e.event_name === PILOT_EVENTS.sessionStarted).length;
    const sessionEnds = last24.filter((e) => e.event_name === PILOT_EVENTS.sessionEnded).length;

    // Avg session duration from paired session events
    let avgSessionMs: number | null = null;
    const endLatencies = last24
      .filter((e) => e.event_name === PILOT_EVENTS.sessionEnded && typeof e.latency_ms === "number")
      .map((e) => e.latency_ms as number);
    if (endLatencies.length > 0) avgSessionMs = Math.round(endLatencies.reduce((a, b) => a + b, 0) / endLatencies.length);

    // Widget usage
    const widgetCounts = new Map<string, number>();
    for (const w of widgets ?? []) {
      const k = String((w as { widget_type?: string }).widget_type ?? "unknown");
      widgetCounts.set(k, (widgetCounts.get(k) ?? 0) + 1);
    }
    const topWidgets = Array.from(widgetCounts.entries())
      .sort((a, b) => b[1] - a[1]).slice(0, 8)
      .map(([widget, count]) => ({ widget, count }));

    // Copilot usage + feedback rollup
    const copilotInvocations = last24.filter((e) =>
      e.event_name === PILOT_EVENTS.copilotInvoked || e.event_name === PILOT_EVENTS.copilotOpened,
    ).length;
    const copilotAnswers = evs.filter((e) => e.event_name === PILOT_EVENTS.copilotAnswered);
    const copilotLatencies = copilotAnswers
      .map((e) => e.latency_ms as number | null).filter((v): v is number => typeof v === "number");
    const avgCopilotLatencyMs = copilotLatencies.length > 0
      ? Math.round(copilotLatencies.reduce((a, b) => a + b, 0) / copilotLatencies.length) : null;
    const cf = copilotFeedback ?? [];
    const upVotes = cf.filter((f) => (f as { reaction: string }).reaction === "up").length;
    const downVotes = cf.filter((f) => (f as { reaction: string }).reaction === "down").length;

    // Recommendations accepted / ignored
    const recRows = recos ?? [];
    const recAccepted = recRows.filter((r) => (r as { status: string }).status === "accepted").length;
    const recIgnored = recRows.filter((r) => {
      const s = (r as { status: string }).status;
      return s === "dismissed" || s === "rejected" || s === "ignored";
    }).length;

    // Error rate
    const errorEvents = last24.filter((e) => e.category === "error").length;
    const errorRate = last24.length > 0 ? errorEvents / last24.length : 0;

    // Performance — avg latency across events with latency_ms
    const latencies = last24
      .map((e) => e.latency_ms as number | null).filter((v): v is number => typeof v === "number");
    const p95 = percentile(latencies, 0.95);

    // AI cost aggregation (last 24h). ai_usage stores cents; expose USD.
    const aiRows = (aiUsage ?? []).filter((r) => new Date((r as { created_at: string }).created_at) >= new Date(since));
    const aiCostUsd = aiRows.reduce((a, r) => a + Number((r as { cost_cents?: number }).cost_cents ?? 0), 0) / 100;
    const aiTokens = aiRows.reduce((a, r) => {
      const row = r as { tokens_in?: number; tokens_out?: number };
      return a + Number(row.tokens_in ?? 0) + Number(row.tokens_out ?? 0);
    }, 0);

    // Health/Adoption rollups
    const orgRows = orgs ?? [];
    const activeOrgs = orgRows.filter((o) => (o as { status: string }).status === "active").length;
    const healths = orgRows.map((o) => Number((o as { health_score?: number }).health_score ?? 0));
    const adopts  = orgRows.map((o) => Number((o as { adoption_score?: number }).adoption_score ?? 0));
    const avgHealth = healths.length ? round2(healths.reduce((a, b) => a + b, 0) / healths.length) : 0;
    const avgAdoption = adopts.length ? round2(adopts.reduce((a, b) => a + b, 0) / adopts.length) : 0;

    // Feature flag adoption (rollout percentage summary)
    const flagRows = flags ?? [];
    const flagsEnabled = flagRows.filter((f) => (f as { enabled: boolean }).enabled).length;
    const avgRollout = flagRows.length
      ? round2(flagRows.reduce((a, f) => a + Number((f as { rollout?: number }).rollout ?? 0), 0) / flagRows.length)
      : 0;

    // Rate-limit blocks in the window
    const rateHitTotal = (rateHits ?? []).reduce((a, r) => a + Number((r as { blocked_count?: number }).blocked_count ?? 0), 0);

    return {
      generatedAt: new Date().toISOString(),
      windowHours: 24,
      totals: {
        activeOrgs,
        totalPilotOrgs: orgRows.length,
        activeUsers,
        sessions,
        sessionsCompleted: sessionEnds,
        avgSessionMs,
        eventsLast24h: last24.length,
        errorEventsLast24h: errorEvents,
        errorRate: round4(errorRate),
        p95LatencyMs: p95,
        aiCostUsd: round2(aiCostUsd),
        aiTokens,
        copilotInvocations,
        avgCopilotLatencyMs,
        copilotThumbsUp: upVotes,
        copilotThumbsDown: downVotes,
        copilotSatisfaction: upVotes + downVotes > 0 ? round2(upVotes / (upVotes + downVotes)) : null,
        recommendationsAccepted: recAccepted,
        recommendationsIgnored: recIgnored,
        avgHealthScore: avgHealth,
        avgAdoptionScore: avgAdoption,
        featureFlagsEnabled: flagsEnabled,
        featureFlagsAvgRollout: avgRollout,
        telemetryBlockedByRateLimit: rateHitTotal,
        feedbackCount: (feedback ?? []).length,
      },
      topWidgets,
      cohorts: orgRows.map((o) => ({
        organizationId: (o as { organization_id: string }).organization_id,
        cohort: (o as { cohort: string }).cohort,
        status: (o as { status: string }).status,
        healthScore: Number((o as { health_score?: number }).health_score ?? 0),
        adoptionScore: Number((o as { adoption_score?: number }).adoption_score ?? 0),
        ttfvSeconds: (o as { ttfv_seconds?: number | null }).ttfv_seconds ?? null,
      })),
    };
  });

// ---------- Copilot contextual feedback ----------

const FeedbackInput = z.object({
  reaction: z.enum(["up", "down"]),
  messageId: z.string().uuid().nullable().optional(),
  conversationId: z.string().uuid().nullable().optional(),
  reasonCode: z.enum(["inaccurate", "irrelevant", "incomplete", "too_slow", "other", "helpful", "actionable", "clear"]).nullable().optional(),
  comment: z.string().trim().max(2000).nullable().optional(),
  modelHint: z.string().trim().max(120).nullable().optional(),
  latencyMs: z.number().int().min(0).max(600_000).nullable().optional(),
});

export const submitCopilotFeedback = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => FeedbackInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: prof } = await supabase.from("profiles").select("organization_id").eq("id", userId).single();
    if (!prof) throw new Error("Perfil não encontrado");
    // Guard: never accept dangerous HTML/script tags in the comment
    const safeComment = data.comment ? data.comment.replace(/<\/?[^>]+>/g, "").slice(0, 2000) : null;
    const { data: row, error } = await supabase
      .from("pilot_copilot_feedback")
      .insert({
        organization_id: (prof as { organization_id: string }).organization_id,
        user_id: userId,
        message_id: data.messageId ?? null,
        conversation_id: data.conversationId ?? null,
        reaction: data.reaction,
        reason_code: data.reasonCode ?? null,
        comment: safeComment,
        model_hint: data.modelHint ?? null,
        latency_ms: data.latencyMs ?? null,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return { ok: true, id: (row as { id: string }).id };
  });

// ---------- Evidence-based backlog ----------

const BacklogInput = z.object({
  title: z.string().trim().min(3).max(200),
  description: z.string().trim().max(4000).optional().nullable(),
  source: z.enum(["pilot_feedback", "telemetry", "support", "executive", "internal", "other"]),
  evidenceRef: z.string().trim().max(500).optional().nullable(),
  organizationsAffected: z.number().int().min(0).max(100_000),
  frequency: z.number().int().min(0).max(1_000_000),
  financialImpactCents: z.number().int().min(0),
  retentionImpact: z.number().min(0).max(100),
  operationalImpact: z.number().min(0).max(100),
  effortDays: z.number().positive().max(365),
});

export const createBacklogItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => BacklogInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: prof } = await supabase.from("profiles").select("organization_id").eq("id", userId).single();
    if (!prof) throw new Error("Perfil não encontrado");
    const evidence: BacklogEvidence = {
      organizationsAffected: data.organizationsAffected,
      frequency: data.frequency,
      financialImpactCents: data.financialImpactCents,
      retentionImpact: data.retentionImpact,
      operationalImpact: data.operationalImpact,
      effortDays: data.effortDays,
    };
    const scored = scoreBacklogItem(evidence);
    const { data: row, error } = await supabase
      .from("pilot_backlog_items")
      .insert({
        organization_id: (prof as { organization_id: string }).organization_id,
        created_by: userId,
        title: data.title,
        description: data.description ?? null,
        source: data.source,
        evidence_ref: data.evidenceRef ?? null,
        organizations_affected: data.organizationsAffected,
        frequency: data.frequency,
        financial_impact_cents: data.financialImpactCents,
        retention_impact: data.retentionImpact,
        operational_impact: data.operationalImpact,
        effort_days: data.effortDays,
        priority_score: scored.score,
        priority_bucket: scored.bucket,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return { item: row, score: scored };
  });

export const listBacklogItems = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("pilot_backlog_items")
      .select("*")
      .order("priority_score", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return { items: data ?? [] };
  });

// ---------- Telemetry ingest (rate-limited + PII-sanitized) ----------

const IngestInput = z.object({
  eventName: z.string().min(1).max(120),
  category: z.enum(["product", "ai", "error", "session", "onboarding"]),
  props: z.record(z.string(), z.unknown()).optional(),
  sessionId: z.string().max(120).nullable().optional(),
  latencyMs: z.number().int().min(0).max(600_000).nullable().optional(),
});

export const ingestPilotEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => IngestInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: prof } = await supabase.from("profiles").select("organization_id").eq("id", userId).single();
    if (!prof) throw new Error("Perfil não encontrado");
    const orgId = (prof as { organization_id: string }).organization_id;
    const { checkPilotRateLimit } = await import("@/lib/pilot/telemetry");
    const decision = checkPilotRateLimit(orgId);
    if (!decision.allowed) {
      // Persist a rate-limit hit for observability
      const bucket = new Date(decision.windowStart).toISOString();
      await supabase.from("pilot_telemetry_rate_hits").upsert({
        organization_id: orgId, bucket, blocked_count: decision.blocked,
      }, { onConflict: "organization_id,bucket" });
      return { emitted: false, rateLimited: true };
    }
    const safeProps = sanitizeProps(data.props);
    const { error } = await supabase.from("pilot_telemetry_events").insert({
      organization_id: orgId,
      user_id: userId,
      event_name: data.eventName,
      category: data.category,
      props: safeProps as never,
      session_id: data.sessionId ?? null,
      latency_ms: data.latencyMs ?? null,
    });
    if (error) throw new Error(error.message);
    return { emitted: true, rateLimited: false };
  });

// ---------- helpers ----------

function percentile(values: number[], p: number): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.floor(p * sorted.length));
  return Math.round(sorted[idx]);
}
function round2(n: number): number { return Math.round(n * 100) / 100; }
function round4(n: number): number { return Math.round(n * 10000) / 10000; }
