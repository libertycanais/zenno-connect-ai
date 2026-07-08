// Structured JSON logger — SaaS multi-tenant.
// Uso: log.info({ event: "user.login", organization_id, user_id }, "user signed in")
// - Nunca logue tokens, senhas, chaves ou dados sensíveis (email/telefone).
// - Em rotas HTTP, extraia request_id/trace_id via `logContextFromRequest(request)`.
// - Isomorphic-safe: funciona no server (Workers/Node) e não quebra o bundle client.

type Level = "debug" | "info" | "warn" | "error";

export type LogContext = {
  request_id?: string;
  trace_id?: string;
  organization_id?: string;
  user_id?: string;
  event?: string;
  [k: string]: unknown;
};

const SERVICE = process.env.SERVICE_NAME ?? "zenno-api";
const VERSION = process.env.APP_VERSION ?? process.env.GIT_SHA ?? "dev";
const ENVIRONMENT =
  process.env.APP_ENV ?? process.env.NODE_ENV ?? "development";

// Chaves que NUNCA devem ser logadas mesmo se passadas por engano.
const REDACT_KEYS = new Set([
  "authorization",
  "cookie",
  "password",
  "token",
  "access_token",
  "refresh_token",
  "api_key",
  "secret",
  "webhook_secret",
  "service_role_key",
]);

function redact(obj: unknown): unknown {
  if (obj == null || typeof obj !== "object") return obj;
  if (Array.isArray(obj)) return obj.map(redact);
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    if (REDACT_KEYS.has(k.toLowerCase())) out[k] = "[REDACTED]";
    else out[k] = redact(v);
  }
  return out;
}

function emit(level: Level, ctx: LogContext, message?: string) {
  const payload = {
    timestamp: new Date().toISOString(),
    level,
    service: SERVICE,
    version: VERSION,
    environment: ENVIRONMENT,
    ...(redact(ctx) as Record<string, unknown>),
    ...(message ? { message } : {}),
  };
  const line = JSON.stringify(payload);
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export const log = {
  debug: (ctx: LogContext, msg?: string) => emit("debug", ctx, msg),
  info: (ctx: LogContext, msg?: string) => emit("info", ctx, msg),
  warn: (ctx: LogContext, msg?: string) => emit("warn", ctx, msg),
  error: (ctx: LogContext, msg?: string) => emit("error", ctx, msg),
};

/** Extrai correlation ids padrão de uma Request. Gera request_id se ausente. */
export function logContextFromRequest(request: Request): LogContext {
  const h = request.headers;
  const request_id =
    h.get("x-request-id") ??
    h.get("cf-ray") ??
    (globalThis.crypto?.randomUUID?.() ?? `req_${Date.now()}`);
  const trace_id =
    h.get("traceparent")?.split("-")[1] ?? h.get("x-trace-id") ?? request_id;
  return { request_id, trace_id };
}
