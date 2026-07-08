// Sprint 5.3 — Observability: optional Sentry integration (env-gated).
// Zero-dependency by default. When SENTRY_DSN is set AND @sentry/* packages
// are installed, `initSentry()` lazy-loads and configures them.
//
// Nothing is imported at module load — a Worker without Sentry pays zero cost.
// Client/Server both gated by env vars:
//   - SENTRY_DSN            (server)
//   - VITE_SENTRY_DSN       (browser)
//   - SENTRY_ENVIRONMENT    (optional)
//   - SENTRY_TRACES_SAMPLE_RATE (optional, 0..1)
//
// Wiring real dependencies belongs to Sprint 5.4 (opt-in).

type SentryLike = {
  init(config: unknown): void;
  captureException(err: unknown, ctx?: unknown): void;
  captureMessage(msg: string, ctx?: unknown): void;
};

let sentry: SentryLike | null = null;
let initialized = false;

function readDsn(scope: "server" | "client"): string | undefined {
  if (scope === "server") {
    return typeof process !== "undefined" ? process.env.SENTRY_DSN : undefined;
  }
  try {
    return (import.meta as unknown as { env?: Record<string, string | undefined> })
      .env?.VITE_SENTRY_DSN;
  } catch {
    return undefined;
  }
}

function readEnv(name: string): string | undefined {
  if (typeof process !== "undefined" && process.env?.[name]) {
    return process.env[name];
  }
  try {
    return (import.meta as unknown as { env?: Record<string, string | undefined> })
      .env?.[name];
  } catch {
    return undefined;
  }
}

/**
 * Idempotent. Returns true if Sentry was initialized (or already active).
 * If the @sentry/* package is not installed or DSN is missing, returns false
 * silently — production must not crash on missing observability.
 */
export async function initSentry(
  scope: "server" | "client",
): Promise<boolean> {
  if (initialized) return sentry !== null;
  initialized = true;
  const dsn = readDsn(scope);
  if (!dsn) return false;

  try {
    // Dynamic import so build does not require the package to exist.
    const pkg = scope === "server" ? "@sentry/node" : "@sentry/browser";
    const mod = (await import(/* @vite-ignore */ pkg).catch(() => null)) as
      | SentryLike
      | null;
    if (!mod) return false;
    sentry = mod;
    const tracesRate = Number(readEnv("SENTRY_TRACES_SAMPLE_RATE") ?? "0");
    sentry.init({
      dsn,
      environment: readEnv("SENTRY_ENVIRONMENT") ?? readEnv("APP_ENV") ?? "development",
      release: readEnv("APP_VERSION") ?? readEnv("GIT_SHA") ?? "dev",
      tracesSampleRate: Number.isFinite(tracesRate) ? tracesRate : 0,
    });
    return true;
  } catch {
    sentry = null;
    return false;
  }
}

export function captureException(err: unknown, ctx?: Record<string, unknown>): void {
  try {
    sentry?.captureException(err, ctx ? { extra: ctx } : undefined);
  } catch {
    /* observability must never throw */
  }
}

export function captureMessage(msg: string, ctx?: Record<string, unknown>): void {
  try {
    sentry?.captureMessage(msg, ctx ? { extra: ctx } : undefined);
  } catch {
    /* noop */
  }
}

export function isSentryEnabled(): boolean {
  return sentry !== null;
}
