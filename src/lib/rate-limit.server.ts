// Server-only helper wrapping public.global_rate_limit_hit(key, limit, window_seconds).
// Fail-open: on any RPC error we do NOT block traffic (log via console) — a broken limiter
// must never take down OAuth/webhooks. Use for OAuth callbacks, webhooks, sensitive
// integration creation, and login. Do NOT use for tracking; tracking has its own limiter.

import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type RateLimitResult = { limited: boolean };

export async function rateLimitHit(
  key: string,
  limit: number,
  windowSeconds = 60,
): Promise<RateLimitResult> {
  try {
    const { data, error } = await supabaseAdmin.rpc("global_rate_limit_hit", {
      _key: key,
      _limit: limit,
      _window_seconds: windowSeconds,
    });
    if (error) {
      console.warn(JSON.stringify({
        level: "warn", service: "rate-limit",
        event: "rate_limit_rpc_error", key, message: error.message,
      }));
      return { limited: false };
    }
    return { limited: data === true };
  } catch (e) {
    console.warn(JSON.stringify({
      level: "warn", service: "rate-limit",
      event: "rate_limit_exception", key,
      message: e instanceof Error ? e.message : String(e),
    }));
    return { limited: false };
  }
}

/** Best-effort client IP extraction (Cloudflare / standard proxy headers). */
export function clientIp(request: Request): string {
  const h = request.headers;
  return (
    h.get("cf-connecting-ip") ??
    h.get("x-real-ip") ??
    (h.get("x-forwarded-for") ?? "").split(",")[0]?.trim() ??
    "unknown"
  ) || "unknown";
}

/** Standard 429 response. */
export function tooManyRequests(retryAfterSeconds = 60): Response {
  return new Response("Too Many Requests", {
    status: 429,
    headers: { "Retry-After": String(retryAfterSeconds) },
  });
}
