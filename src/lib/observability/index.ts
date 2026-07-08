// Sprint 5.3 — Observability barrel. Re-exports the additive telemetry surface.
// Import from `@/lib/observability` — call sites remain stable if the
// underlying implementation is swapped (e.g. OTel or Sentry in Sprint 5.4).

export { log, logContextFromRequest } from "@/lib/logger";
export type { LogContext } from "@/lib/logger";

export {
  incCounter,
  observe,
  snapshot,
  timed,
  __resetMetrics,
} from "./metrics";
export type { MetricLabels, MetricsSnapshot } from "./metrics";

export { getTracer, setTracer } from "./tracing";
export type { Tracer, Span, SpanKind, SpanAttributes, SpanStatus } from "./tracing";

export {
  initSentry,
  captureException,
  captureMessage,
  isSentryEnabled,
} from "./sentry";

export { METRICS, LABEL_KEYS } from "./catalog";
export type { MetricName } from "./catalog";

export { toPrometheusText } from "./prometheus";
