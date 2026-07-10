// RC2 Pilot Program — Telemetry event catalog + in-memory sink (SSR-safe).
// RC2 Operational Enhancements: recursive PII sanitization, expanded event
// catalog (functional telemetry), and org-scoped in-memory rate limiter.
// Additive only; does not touch existing observability. Persistence uses
// Supabase via `pilot.functions.ts` server functions.

export type PilotEventCategory = "product" | "ai" | "error" | "session" | "onboarding";

export interface PilotEvent {
  organizationId: string;
  userId?: string | null;
  eventName: string;
  category: PilotEventCategory;
  props?: Record<string, unknown>;
  sessionId?: string | null;
  latencyMs?: number | null;
  occurredAt?: string;
}

// Canonical event names — Fase 2 metrics + RC2 Operational functional events.
export const PILOT_EVENTS = {
  // Onboarding / activation
  onboardingStarted: "onboarding.started",
  onboardingStepCompleted: "onboarding.step_completed",
  onboardingCompleted: "onboarding.completed",
  firstValue: "activation.first_value",
  // Session
  sessionStarted: "session.started",
  sessionEnded: "session.ended",
  // Generic product usage
  featureUsed: "product.feature_used",
  widgetOpened: "product.widget_opened",
  recommendationAccepted: "product.recommendation_accepted",
  recommendationDismissed: "product.recommendation_dismissed",
  // AI usage / cost
  copilotInvoked: "ai.copilot_invoked",
  aiTokensConsumed: "ai.tokens_consumed",
  // Errors
  errorOccurred: "error.occurred",
  crashOccurred: "error.crash",
  // RC2 Operational — functional business events
  copilotOpened: "ai.copilot_opened",
  copilotAnswered: "ai.copilot_answered",
  recommendationRejected: "product.recommendation_rejected",
  workflowExecuted: "product.workflow_executed",
  dashboardViewed: "product.dashboard_viewed",
  widgetAdded: "product.widget_added",
  widgetRemoved: "product.widget_removed",
  workspaceCustomized: "product.workspace_customized",
  campaignAnalyzed: "ai.campaign_analyzed",
  financeAnalyzed: "ai.finance_analyzed",
  crmAnalyzed: "ai.crm_analyzed",
  executiveViewed: "product.executive_viewed",
  insightOpened: "product.insight_opened",
  timelineViewed: "product.timeline_viewed",
} as const;

export type PilotEventName = (typeof PILOT_EVENTS)[keyof typeof PILOT_EVENTS];

// Case-insensitive PII / secret keys — redacted at any depth.
const REDACT_KEYS = new Set([
  "password", "passwordhash", "token", "accesstoken", "refreshtoken",
  "apikey", "api_key", "secret", "client_secret", "clientsecret",
  "email", "phone", "cpf", "cnpj", "rg",
  "authorization", "cookie", "creditcard", "cardnumber", "card_number",
  "bearer", "session_token", "sessiontoken",
]);
const MAX_STRING = 2000;
const MAX_DEPTH = 8;
const REDACTED = "[REDACTED]";

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v)
    && (Object.getPrototypeOf(v) === Object.prototype || Object.getPrototypeOf(v) === null);
}

function sanitizeValue(value: unknown, depth: number): unknown {
  if (depth > MAX_DEPTH) return "[TRUNCATED_DEPTH]";
  if (value === null || value === undefined) return value;
  if (typeof value === "string") {
    return value.length > MAX_STRING ? value.slice(0, MAX_STRING) + "…" : value;
  }
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (Array.isArray(value)) {
    return value.slice(0, 200).map((v) => sanitizeValue(v, depth + 1));
  }
  if (isPlainObject(value)) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      if (REDACT_KEYS.has(k.toLowerCase())) { out[k] = REDACTED; continue; }
      out[k] = sanitizeValue(v, depth + 1);
    }
    return out;
  }
  // dates, bigints, class instances, functions → drop to safe primitive
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "bigint") return value.toString();
  return String(value).slice(0, MAX_STRING);
}

/** Recursively sanitize event props: redacts PII/secret keys at any depth,
 *  truncates long strings, caps array size, and hard-limits recursion depth. */
export function sanitizeProps(props: Record<string, unknown> | undefined): Record<string, unknown> {
  if (!props) return {};
  return sanitizeValue(props, 0) as Record<string, unknown>;
}

// ---------- Org-scoped rate limiter (in-memory, SSR-safe) ----------

export interface RateLimitConfig { maxPerWindow: number; windowMs: number; }
export const DEFAULT_PILOT_RATE_LIMIT: RateLimitConfig = { maxPerWindow: 240, windowMs: 60_000 };

interface Bucket { windowStart: number; count: number; blocked: number; }
const _buckets = new Map<string, Bucket>();
const _blockedTotals = new Map<string, number>();

export interface RateDecision { allowed: boolean; count: number; blocked: number; windowStart: number; }

export function checkPilotRateLimit(
  organizationId: string,
  cfg: RateLimitConfig = DEFAULT_PILOT_RATE_LIMIT,
  now: number = Date.now(),
): RateDecision {
  const key = organizationId;
  const winStart = Math.floor(now / cfg.windowMs) * cfg.windowMs;
  const cur = _buckets.get(key);
  const bucket: Bucket = !cur || cur.windowStart !== winStart
    ? { windowStart: winStart, count: 0, blocked: 0 }
    : cur;
  bucket.count += 1;
  const allowed = bucket.count <= cfg.maxPerWindow;
  if (!allowed) {
    bucket.blocked += 1;
    _blockedTotals.set(key, (_blockedTotals.get(key) ?? 0) + 1);
  }
  _buckets.set(key, bucket);
  return { allowed, count: bucket.count, blocked: bucket.blocked, windowStart: winStart };
}

export function getBlockedTotals(): ReadonlyMap<string, number> { return _blockedTotals; }
export function resetPilotRateLimits(): void { _buckets.clear(); _blockedTotals.clear(); }

// ---------- Sink ----------

export interface PilotTelemetrySink {
  emit(event: PilotEvent): void | Promise<void>;
}

export class InMemoryPilotSink implements PilotTelemetrySink {
  readonly events: PilotEvent[] = [];
  emit(event: PilotEvent): void { this.events.push({ ...event, props: sanitizeProps(event.props) }); }
  clear(): void { this.events.length = 0; }
  count(name: string): number { return this.events.filter((e) => e.eventName === name).length; }
  byOrg(orgId: string): PilotEvent[] { return this.events.filter((e) => e.organizationId === orgId); }
  byCategory(cat: PilotEventCategory): PilotEvent[] { return this.events.filter((e) => e.category === cat); }
}

let _sink: PilotTelemetrySink = new InMemoryPilotSink();
export function setPilotSink(sink: PilotTelemetrySink): void { _sink = sink; }
export function getPilotSink(): PilotTelemetrySink { return _sink; }

export interface TrackResult { emitted: boolean; rateLimited: boolean; }

/** Record a pilot event. Applies org-scoped rate limiting + PII sanitization.
 *  Returns `{ emitted, rateLimited }` — never throws. */
export function trackPilotEvent(event: PilotEvent, cfg: RateLimitConfig = DEFAULT_PILOT_RATE_LIMIT): TrackResult {
  const decision = checkPilotRateLimit(event.organizationId, cfg);
  if (!decision.allowed) return { emitted: false, rateLimited: true };
  try {
    void _sink.emit({
      ...event,
      props: sanitizeProps(event.props),
      occurredAt: event.occurredAt ?? new Date().toISOString(),
    });
    return { emitted: true, rateLimited: false };
  } catch {
    return { emitted: false, rateLimited: false };
  }
}
