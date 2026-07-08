import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { normalizeAllowedOrigins } from "@/lib/tracking-security";

export const getTrackingConfig = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data: prof } = await supabase.from("profiles").select("organization_id").maybeSingle();
    if (!prof?.organization_id) throw new Error("Organização não encontrada.");
    const { data: org } = await supabase
      .from("organizations")
      .select("id, name, tracking_public_key, tracking_allowed_origins")
      .eq("id", prof.organization_id)
      .single();
    return { organization: org };
  });

export const listTrackingLeads = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        source: z.enum(["meta", "google", "all"]).default("all"),
        limit: z.number().int().min(1).max(500).default(100),
      })
      .parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    let q = supabase
      .from("tracking_leads")
      .select(
        "id, session_id, email, phone, name, first_utm_source, first_utm_medium, first_utm_campaign, first_utm_content, first_fbclid, first_gclid, first_landing_url, first_seen_at, last_seen_at, events_count, conversion_value, status",
      )
      .order("last_seen_at", { ascending: false })
      .limit(data.limit);
    if (data.source === "meta") {
      q = q.or(
        "first_fbclid.not.is.null,first_utm_source.ilike.%meta%,first_utm_source.ilike.%facebook%,first_utm_source.ilike.%instagram%",
      );
    } else if (data.source === "google") {
      q = q.or("first_gclid.not.is.null,first_utm_source.ilike.%google%");
    }
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return { leads: rows ?? [] };
  });

export const listTrackingEvents = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        sessionId: z.string().optional(),
        limit: z.number().int().min(1).max(500).default(50),
      })
      .parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    let q = supabase
      .from("tracking_events")
      .select(
        "id, event_name, event_source_url, referrer, utm_source, utm_campaign, utm_content, fbclid, gclid, value, currency, ip, country, created_at, session_id",
      )
      .order("created_at", { ascending: false })
      .limit(data.limit);
    if (data.sessionId) q = q.eq("session_id", data.sessionId);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return { events: rows ?? [] };
  });

export const trackingAttribution = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        source: z.enum(["meta", "google"]),
        days: z.number().int().min(1).max(180).default(30),
      })
      .parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const since = new Date(Date.now() - data.days * 86400_000).toISOString();
    const filterCol = data.source === "meta" ? "first_fbclid" : "first_gclid";
    const utmFilter =
      data.source === "meta"
        ? "first_utm_source.ilike.%meta%,first_utm_source.ilike.%facebook%,first_utm_source.ilike.%instagram%"
        : "first_utm_source.ilike.%google%";

    const { data: rows, error } = await supabase
      .from("tracking_leads")
      .select("first_utm_campaign, first_utm_content, status, conversion_value, events_count")
      .gte("last_seen_at", since)
      .or(`${filterCol}.not.is.null,${utmFilter}`);
    if (error) throw new Error(error.message);

    const map = new Map<
      string,
      {
        campaign: string;
        ad: string;
        clicks: number;
        leads: number;
        customers: number;
        revenue: number;
      }
    >();
    for (const r of rows ?? []) {
      const campaign = r.first_utm_campaign || "(sem campanha)";
      const ad = r.first_utm_content || "—";
      const key = `${campaign}||${ad}`;
      const cur = map.get(key) ?? { campaign, ad, clicks: 0, leads: 0, customers: 0, revenue: 0 };
      cur.clicks += r.events_count ?? 0;
      if (r.status === "lead") cur.leads += 1;
      if (r.status === "customer") {
        cur.customers += 1;
        cur.revenue += Number(r.conversion_value ?? 0);
      }
      map.set(key, cur);
    }
    return {
      rows: Array.from(map.values()).sort(
        (a, b) => b.leads + b.customers - (a.leads + a.customers),
      ),
    };
  });

export const updateTrackingOrigins = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        origins: z.array(z.string().trim().min(1).max(253)).max(50),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: prof } = await supabase.from("profiles").select("organization_id").maybeSingle();
    if (!prof?.organization_id) throw new Error("Organização não encontrada.");

    // Só owner/admin pode alterar a allowlist
    const { data: isOwner } = await supabase.rpc("has_role", {
      _user_id: userId,
      _role: "owner",
      _org_id: prof.organization_id,
    });
    const { data: isAdmin } = await supabase.rpc("has_role", {
      _user_id: userId,
      _role: "admin",
      _org_id: prof.organization_id,
    });
    if (!isOwner && !isAdmin)
      throw new Error("Somente owner/admin pode alterar domínios do rastreio.");

    const normalized = normalizeAllowedOrigins(data.origins);

    const { error } = await supabase
      .from("organizations")
      .update({ tracking_allowed_origins: normalized })
      .eq("id", prof.organization_id);
    if (error) throw new Error(error.message);
    return { origins: normalized };
  });
