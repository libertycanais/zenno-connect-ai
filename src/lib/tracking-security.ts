const HOST_ALLOWLIST_PATTERN = /^(\*\.)?[a-z0-9.-]+\.[a-z]{2,}$/;

export const TRACKING_IP_RATE_LIMIT_PER_MINUTE = 60;
export const TRACKING_PUBLIC_KEY_RATE_LIMIT_PER_MINUTE = 600;

export const trackingBaseCors = {
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "600",
  Vary: "Origin",
} as const;

export function corsFor(origin: string | null): Record<string, string> {
  if (!origin) return { ...trackingBaseCors };
  return { ...trackingBaseCors, "Access-Control-Allow-Origin": origin };
}

export function hostOf(url: string | null): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
}

export function normalizeAllowedOrigin(entry: string): string | null {
  const normalized = entry
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "");

  if (!normalized || !HOST_ALLOWLIST_PATTERN.test(normalized)) return null;
  return normalized;
}

export function normalizeAllowedOrigins(entries: readonly string[] | null | undefined): string[] {
  return Array.from(
    new Set(
      (entries ?? [])
        .map(normalizeAllowedOrigin)
        .filter((entry): entry is string => entry !== null),
    ),
  ).sort();
}

export function originAllowed(reqHost: string | null, allowed: readonly string[]): boolean {
  if (!reqHost) return false;

  return normalizeAllowedOrigins(allowed).some((allowedHost) => {
    if (allowedHost.startsWith("*.")) {
      const suffix = allowedHost.slice(1);
      return reqHost === allowedHost.slice(2) || reqHost.endsWith(suffix);
    }

    return reqHost === allowedHost;
  });
}

export type TrackingOriginDecision =
  | { allowed: true; normalizedAllowedOrigins: string[] }
  | {
      allowed: false;
      normalizedAllowedOrigins: string[];
      reason: "missing_allowed_origins" | "missing_request_origin" | "origin_not_allowed";
    };

export function trackingOriginDecision(
  reqHost: string | null,
  allowedOrigins: readonly string[] | null | undefined,
): TrackingOriginDecision {
  const normalizedAllowedOrigins = normalizeAllowedOrigins(allowedOrigins);

  if (normalizedAllowedOrigins.length === 0) {
    return { allowed: false, normalizedAllowedOrigins, reason: "missing_allowed_origins" };
  }

  if (!reqHost) {
    return { allowed: false, normalizedAllowedOrigins, reason: "missing_request_origin" };
  }

  if (!originAllowed(reqHost, normalizedAllowedOrigins)) {
    return { allowed: false, normalizedAllowedOrigins, reason: "origin_not_allowed" };
  }

  return { allowed: true, normalizedAllowedOrigins };
}

export function trackingRateLimitKeys(
  orgId: string,
  publicKey: string,
  ip: string,
): { ipKey: string; publicKeyKey: string } {
  return {
    ipKey: `tracking:event:ip:${orgId}:${publicKey}:${ip}`,
    publicKeyKey: `tracking:event:pk:${orgId}:${publicKey}`,
  };
}

export function safeTrackingAuditData(params: {
  reason: string;
  requestHost: string | null;
  allowedOriginsCount: number;
  hasOrigin: boolean;
  hasReferer: boolean;
  eventName?: string | null;
  sessionId?: string | null;
}): Record<string, string | number | boolean | null> {
  return {
    reason: params.reason,
    request_host: params.requestHost,
    allowed_origins_count: params.allowedOriginsCount,
    has_origin: params.hasOrigin,
    has_referer: params.hasReferer,
    event_name: params.eventName ?? null,
    session_id: params.sessionId ?? null,
  };
}
