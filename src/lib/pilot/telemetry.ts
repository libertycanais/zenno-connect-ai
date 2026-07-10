// RC2 Pilot Program — Telemetry event catalog + in-memory sink (SSR-safe).
// Additive; does not touch existing observability. Persistence uses Supabase
// via `pilot.functions.ts` server functions.

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

// Canonical event names (Fase 2 metrics).
export const PILOT_EVENTS = {
  onboardingStarted: "onboarding.started",
  onboardingStepCompleted: "onboarding.step_completed",
  onboardingCompleted: "onboarding.completed",
  firstValue: "activation.first_value", // TTFV marker
  sessionStarted: "session.started",
  sessionEnded: "session.ended",
  featureUsed: "product.feature_used",
  widgetOpened: "product.widget_opened",
  recommendationAccepted: "product.recommendation_accepted",
  recommendationDismissed: "product.recommendation_dismissed",
  copilotInvoked: "ai.copilot_invoked",
  aiTokensConsumed: "ai.tokens_consumed",
  errorOccurred: "error.occurred",
  crashOccurred: "error.crash",
} as const;

export type PilotEventName = (typeof PILOT_EVENTS)[keyof typeof PILOT_EVENTS];

// Fields that must NEVER be stored in props (session replay anonymization).
const REDACT_KEYS = new Set([
  "password", "passwordHash", "token", "accessToken", "refreshToken",
  "apiKey", "api_key", "secret", "email", "phone", "cpf", "cnpj",
  "authorization", "cookie", "creditCard", "cardNumber",
]);

export function sanitizeProps(props: Record<string, unknown> | undefined): Record<string, unknown> {
  if (!props) return {};
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(props)) {
    if (REDACT_KEYS.has(k)) { out[k] = "[REDACTED]"; continue; }
    if (typeof v === "string" && v.length > 2000) { out[k] = v.slice(0, 2000) + "…"; continue; }
    out[k] = v;
  }
  return out;
}

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

export function trackPilotEvent(event: PilotEvent): void {
  void _sink.emit({ ...event, props: sanitizeProps(event.props), occurredAt: event.occurredAt ?? new Date().toISOString() });
}
