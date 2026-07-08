// Sprint 5.3 — Observability: catálogo canônico de nomes de métricas.
// Constantes usadas em toda a base para evitar drift de naming.
// Compatível com Prometheus (snake_case, sufixos _total / _ms / _bytes).
//
// Adicione novos nomes AQUI antes de emitir do call site. Não altere nomes
// existentes sem versionar (quebra dashboards / alertas externos).

export const METRICS = {
  // Application
  APP_REQUESTS_TOTAL: "app_requests_total",
  APP_REQUEST_DURATION_MS: "app_request_duration_ms",
  APP_ERRORS_TOTAL: "app_errors_total",

  // Tracking
  TRACKING_EVENTS_TOTAL: "tracking_events_total",
  TRACKING_SESSIONS_TOTAL: "tracking_sessions_total",
  TRACKING_ATTRIBUTION_TOTAL: "tracking_attribution_total",
  TRACKING_INGEST_DURATION_MS: "tracking_ingest_duration_ms",

  // OAuth
  OAUTH_META_TOTAL: "oauth_meta_total",
  OAUTH_GOOGLE_TOTAL: "oauth_google_total",
  OAUTH_REFRESH_TOTAL: "oauth_refresh_total",
  OAUTH_ERRORS_TOTAL: "oauth_errors_total",

  // Providers (via Provider Layer — nunca ler chaves aqui)
  PROVIDER_ADS_CALLS_TOTAL: "provider_ads_calls_total",
  PROVIDER_WHATSAPP_CALLS_TOTAL: "provider_whatsapp_calls_total",
  PROVIDER_PAYMENTS_CALLS_TOTAL: "provider_payments_calls_total",
  PROVIDER_AI_CALLS_TOTAL: "provider_ai_calls_total",
  PROVIDER_CALL_DURATION_MS: "provider_call_duration_ms",

  // Database
  DB_QUERIES_TOTAL: "db_queries_total",
  DB_QUERY_DURATION_MS: "db_query_duration_ms",
  DB_SLOW_QUERIES_TOTAL: "db_slow_queries_total",
  DB_ERRORS_TOTAL: "db_errors_total",
} as const;

export type MetricName = (typeof METRICS)[keyof typeof METRICS];

/** Rótulos padronizados. Nunca inclua PII, tokens ou org-name legível. */
export const LABEL_KEYS = [
  "service",
  "environment",
  "route",
  "method",
  "status",
  "provider",
  "queue",
  "operation",
] as const;
