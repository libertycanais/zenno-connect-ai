import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  corsFor,
  hostOf,
  safeTrackingAuditData,
  TRACKING_IP_RATE_LIMIT_PER_MINUTE,
  TRACKING_PUBLIC_KEY_RATE_LIMIT_PER_MINUTE,
  trackingOriginDecision,
  trackingRateLimitKeys,
} from "@/lib/tracking-security";

const payloadSchema = z.object({
  pk: z.string().min(8).max(80),
  session_id: z.string().min(8).max(128),
  event_name: z.string().min(1).max(64),
  page: z.string().max(2048).optional().nullable(),
  page_title: z.string().max(512).optional().nullable(),
  referrer: z.string().max(2048).optional().nullable(),
  utm_source: z.string().max(255).optional().nullable(),
  utm_medium: z.string().max(255).optional().nullable(),
  utm_campaign: z.string().max(255).optional().nullable(),
  utm_term: z.string().max(255).optional().nullable(),
  utm_content: z.string().max(255).optional().nullable(),
  utm_id: z.string().max(255).optional().nullable(),
  fbclid: z.string().max(512).optional().nullable(),
  gclid: z.string().max(512).optional().nullable(),
  gbraid: z.string().max(512).optional().nullable(),
  wbraid: z.string().max(512).optional().nullable(),
  ttclid: z.string().max(512).optional().nullable(),
  msclkid: z.string().max(512).optional().nullable(),
  email: z.string().email().max(255).optional().nullable(),
  phone: z.string().max(32).optional().nullable(),
  name: z.string().max(255).optional().nullable(),
  external_id: z.string().max(255).optional().nullable(),
  value: z.number().nonnegative().max(1_000_000).optional().nullable(),
  currency: z.string().min(3).max(3).optional().nullable(),
}).passthrough();

export const Route = createFileRoute("/api/public/track/event")({
  server: {
    handlers: {
      OPTIONS: async ({ request }) => new Response(null, {
        status: 204,
        headers: corsFor(request.headers.get("origin")),
      }),
      POST: async ({ request }) => {
        const originHeader = request.headers.get("origin");
        const refererHeader = request.headers.get("referer");
        const reqHost = hostOf(originHeader) ?? hostOf(refererHeader);
        const cors = corsFor(originHeader);

        let json: unknown;
        try { json = await request.json(); }
        catch { return errResp(400, "invalid_json", cors); }

        const parsed = payloadSchema.safeParse(json);
        if (!parsed.success) return errResp(400, "invalid_payload", cors);
        const data = parsed.data;

        const { data: org } = await supabaseAdmin
          .from("organizations")
          .select("id, tracking_allowed_origins")
          .eq("tracking_public_key", data.pk)
          .maybeSingle();
        if (!org) return errResp(400, "invalid_pk", cors);

        const originDecision = trackingOriginDecision(
          reqHost,
          (org as { tracking_allowed_origins?: string[] | null }).tracking_allowed_origins,
        );
        const allowed = originDecision.normalizedAllowedOrigins;
        if (!originDecision.allowed) {
          await auditSuspiciousTracking({
            orgId: org.id,
            reason: originDecision.reason,
            reqHost,
            originHeader,
            refererHeader,
            eventName: data.event_name,
            sessionId: data.session_id,
            allowedCount: allowed.length,
            ip: request.headers.get("cf-connecting-ip")
              || request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
              || null,
            userAgent: request.headers.get("user-agent"),
          });
          return errResp(403, "origin_not_allowed", cors);
        }

        const ip = request.headers.get("cf-connecting-ip")
          || request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
          || null;
        const ua = request.headers.get("user-agent");
        const country = request.headers.get("cf-ipcountry");

        const safeIp = ip ?? "unknown";
        const rateLimitKeys = trackingRateLimitKeys(org.id, data.pk, safeIp);
        const [{ data: ipThrottled }, { data: publicKeyThrottled }] = await Promise.all([
          supabaseAdmin.rpc("track_compound_rate_limit_hit", {
            _org: org.id,
            _key: rateLimitKeys.ipKey,
            _max: TRACKING_IP_RATE_LIMIT_PER_MINUTE,
          }),
          supabaseAdmin.rpc("track_compound_rate_limit_hit", {
            _org: org.id,
            _key: rateLimitKeys.publicKeyKey,
            _max: TRACKING_PUBLIC_KEY_RATE_LIMIT_PER_MINUTE,
          }),
        ]);
        if (ipThrottled === true || publicKeyThrottled === true) {
          await auditSuspiciousTracking({
            orgId: org.id,
            reason: publicKeyThrottled === true ? "public_key_rate_limited" : "ip_rate_limited",
            reqHost,
            originHeader,
            refererHeader,
            eventName: data.event_name,
            sessionId: data.session_id,
            allowedCount: allowed.length,
            ip,
            userAgent: ua,
          });
          return errResp(429, "rate_limited", cors);
        }

        await supabaseAdmin.from("tracking_events").insert({
          organization_id: org.id,
          session_id: data.session_id,
          event_name: data.event_name,
          event_source_url: data.page ?? null,
          referrer: data.referrer ?? null,
          page_title: data.page_title ?? null,
          utm_source: data.utm_source ?? null,
          utm_medium: data.utm_medium ?? null,
          utm_campaign: data.utm_campaign ?? null,
          utm_term: data.utm_term ?? null,
          utm_content: data.utm_content ?? null,
          utm_id: data.utm_id ?? null,
          fbclid: data.fbclid ?? null,
          gclid: data.gclid ?? null,
          gbraid: data.gbraid ?? null,
          wbraid: data.wbraid ?? null,
          ttclid: data.ttclid ?? null,
          msclkid: data.msclkid ?? null,
          email: data.email ?? null,
          phone: data.phone ?? null,
          external_id: data.external_id ?? null,
          value: data.value ?? null,
          currency: data.currency ?? null,
          ip,
          user_agent: ua,
          country,
          raw: JSON.parse(JSON.stringify(json)),
        });

        // upsert tracking_leads (first-touch preservada)
        const { data: existing } = await supabaseAdmin
          .from("tracking_leads")
          .select("id, events_count, conversion_value, status")
          .eq("organization_id", org.id)
          .eq("session_id", data.session_id)
          .maybeSingle();

        const nowIso = new Date().toISOString();
        const lastTouch = {
          last_utm_source: data.utm_source ?? null,
          last_utm_medium: data.utm_medium ?? null,
          last_utm_campaign: data.utm_campaign ?? null,
          last_fbclid: data.fbclid ?? null,
          last_gclid: data.gclid ?? null,
          last_seen_at: nowIso,
        };

        const newStatus = data.event_name === "purchase" || data.event_name === "Purchase"
          ? "customer"
          : data.event_name === "lead" || data.event_name === "Lead" || data.email || data.phone
            ? "lead"
            : existing?.status ?? "visitor";

        if (existing) {
          await supabaseAdmin.from("tracking_leads").update({
            ...lastTouch,
            email: data.email ?? undefined,
            phone: data.phone ?? undefined,
            name: data.name ?? undefined,
            events_count: (existing.events_count ?? 0) + 1,
            conversion_value: Number(existing.conversion_value ?? 0) + Number(data.value ?? 0),
            status: newStatus,
          }).eq("id", existing.id);
        } else {
          await supabaseAdmin.from("tracking_leads").insert({
            organization_id: org.id,
            session_id: data.session_id,
            email: data.email ?? null,
            phone: data.phone ?? null,
            name: data.name ?? null,
            first_utm_source: data.utm_source ?? null,
            first_utm_medium: data.utm_medium ?? null,
            first_utm_campaign: data.utm_campaign ?? null,
            first_utm_term: data.utm_term ?? null,
            first_utm_content: data.utm_content ?? null,
            first_utm_id: data.utm_id ?? null,
            first_fbclid: data.fbclid ?? null,
            first_gclid: data.gclid ?? null,
            first_referrer: data.referrer ?? null,
            first_landing_url: data.page ?? null,
            ...lastTouch,
            events_count: 1,
            conversion_value: Number(data.value ?? 0),
            status: newStatus,
          });
        }

        if (originDecision.allowed
            && (data.event_name === "lead" || data.event_name === "Lead"
              || data.event_name === "purchase" || data.event_name === "Purchase")) {
          try { await dispatchAttribution(org.id, data, ip, ua); } catch { /* silent */ }
        }

        return new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { ...cors, "Content-Type": "application/json" },
        });
      },
    },
  },
});

function errResp(status: number, code: string, cors: Record<string, string>) {
  return new Response(JSON.stringify({ ok: false, error: code }), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

async function auditSuspiciousTracking(params: {
  orgId: string;
  reason: string;
  reqHost: string | null;
  originHeader: string | null;
  refererHeader: string | null;
  eventName: string | null;
  sessionId: string | null;
  allowedCount: number;
  ip: string | null;
  userAgent: string | null;
}) {
  try {
    await supabaseAdmin.rpc("app_write_audit_log", {
      _actor_user_id: null as unknown as string,
      _actor_org_id: params.orgId,
      _action: "TRACKING_REJECTED",
      _entity_type: "tracking_event",
      _entity_id: params.sessionId ?? "public-tracking",
      _old_data: null,
      _new_data: safeTrackingAuditData({
        reason: params.reason,
        requestHost: params.reqHost,
        allowedOriginsCount: params.allowedCount,
        hasOrigin: Boolean(params.originHeader),
        hasReferer: Boolean(params.refererHeader),
        eventName: params.eventName,
        sessionId: params.sessionId,
      }),
      _request_id: undefined,
      _trace_id: undefined,
      _ip: params.ip ?? undefined,
      _user_agent: params.userAgent ?? undefined,
    });
  } catch {
    // Audit logging is best-effort; never expose internals to public callers.
  }
}

async function dispatchAttribution(
  orgId: string,
  data: z.infer<typeof payloadSchema>,
  ip: string | null,
  ua: string | null,
) {
  const { createHash } = await import("crypto");
  const sha = (v: string) => createHash("sha256").update(v.trim().toLowerCase()).digest("hex");

  if (data.fbclid || data.email || data.phone) {
    const { data: metaAcc } = await supabaseAdmin
      .from("meta_ad_accounts")
      .select("id, access_token, pixel_id")
      .eq("organization_id", orgId)
      .eq("status", "active")
      .not("pixel_id", "is", null)
      .limit(1)
      .maybeSingle();
    if (metaAcc?.pixel_id && metaAcc.access_token) {
      const eventName = (data.event_name === "purchase" || data.event_name === "Purchase") ? "Purchase" : "Lead";
      const eventId = `${Date.now()}-${data.session_id.slice(0, 8)}`;
      const user_data: Record<string, string | string[]> = {};
      if (data.email) user_data.em = sha(data.email);
      if (data.phone) user_data.ph = sha(data.phone.replace(/\D/g, ""));
      if (ip) user_data.client_ip_address = ip;
      if (ua) user_data.client_user_agent = ua;
      if (data.fbclid) user_data.fbc = `fb.1.${Math.floor(Date.now() / 1000)}.${data.fbclid}`;
      const custom_data: Record<string, unknown> = {};
      if (data.value != null) custom_data.value = data.value;
      if (data.currency) custom_data.currency = data.currency;
      const body = {
        data: [{
          event_name: eventName,
          event_time: Math.floor(Date.now() / 1000),
          event_id: eventId,
          action_source: "website",
          event_source_url: data.page ?? undefined,
          user_data,
          custom_data,
        }],
      };
      const res = await fetch(
        `https://graph.facebook.com/v20.0/${metaAcc.pixel_id}/events?access_token=${metaAcc.access_token}`,
        { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) },
      );
      const respJson = await res.json().catch(() => ({}));
      await supabaseAdmin.from("meta_conversion_events").insert({
        organization_id: orgId,
        ad_account_id: metaAcc.id,
        pixel_id: metaAcc.pixel_id,
        event_name: eventName,
        event_id: eventId,
        event_source_url: data.page ?? null,
        user_data: JSON.parse(JSON.stringify(user_data)),
        custom_data: JSON.parse(JSON.stringify(custom_data)),
        status: res.ok ? "sent" : "error",
        response: JSON.parse(JSON.stringify(respJson ?? {})),
        error: res.ok ? null : `HTTP ${res.status}`,
        sent_at: new Date().toISOString(),
      });
    }
  }

  if (data.gclid) {
    const { data: gAcc } = await supabaseAdmin
      .from("google_ad_accounts")
      .select("id")
      .eq("organization_id", orgId)
      .eq("status", "active")
      .limit(1)
      .maybeSingle();
    await supabaseAdmin.from("google_ads_conversions").insert({
      organization_id: orgId,
      account_id: gAcc?.id ?? null,
      conversion_action: data.event_name === "purchase" ? "purchase" : "lead",
      gclid: data.gclid,
      conversion_date_time: new Date().toISOString(),
      conversion_value: data.value ?? null,
      currency: data.currency ?? null,
      status: "pending",
    });
  }
}
