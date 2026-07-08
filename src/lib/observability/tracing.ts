// Sprint 5.3 — Observability: tracing abstraction (OpenTelemetry-shaped).
// Interface-only. No dependencies. Default implementation is a no-op that
// integrates with the structured logger for correlation.
//
// Sprint 5.4 pode ligar OTel real (@opentelemetry/api) sem alterar call sites.

import { log } from "@/lib/logger";

export type SpanKind = "internal" | "server" | "client" | "producer" | "consumer";

export type SpanAttributes = Record<string, string | number | boolean | undefined>;

export type SpanStatus = { code: "ok" | "error"; message?: string };

export interface Span {
  readonly traceId: string;
  readonly spanId: string;
  setAttribute(key: string, value: string | number | boolean): void;
  setAttributes(attrs: SpanAttributes): void;
  setStatus(status: SpanStatus): void;
  recordException(err: unknown): void;
  end(): void;
}

export interface Tracer {
  startSpan(name: string, options?: { kind?: SpanKind; attributes?: SpanAttributes; traceId?: string }): Span;
  withSpan<T>(name: string, fn: (span: Span) => Promise<T> | T, options?: { attributes?: SpanAttributes; traceId?: string }): Promise<T>;
}

function randHex(bytes: number): string {
  const arr = new Uint8Array(bytes);
  (globalThis.crypto ?? crypto).getRandomValues(arr);
  return Array.from(arr, (b) => b.toString(16).padStart(2, "0")).join("");
}

class NoopSpan implements Span {
  readonly traceId: string;
  readonly spanId: string;
  private name: string;
  private attrs: SpanAttributes = {};
  private started: number;
  private ended = false;
  private status: SpanStatus = { code: "ok" };

  constructor(name: string, traceId?: string) {
    this.name = name;
    this.traceId = traceId ?? randHex(16);
    this.spanId = randHex(8);
    this.started =
      typeof performance !== "undefined" ? performance.now() : Date.now();
  }

  setAttribute(key: string, value: string | number | boolean): void {
    this.attrs[key] = value;
  }

  setAttributes(attrs: SpanAttributes): void {
    Object.assign(this.attrs, attrs);
  }

  setStatus(status: SpanStatus): void {
    this.status = status;
  }

  recordException(err: unknown): void {
    this.status = {
      code: "error",
      message: err instanceof Error ? err.message : String(err),
    };
  }

  end(): void {
    if (this.ended) return;
    this.ended = true;
    const dur =
      (typeof performance !== "undefined" ? performance.now() : Date.now()) -
      this.started;
    log[this.status.code === "error" ? "error" : "debug"](
      {
        trace_id: this.traceId,
        span_id: this.spanId,
        span: this.name,
        duration_ms: Math.round(dur),
        status: this.status.code,
        ...this.attrs,
      },
      this.status.message,
    );
  }
}

class NoopTracer implements Tracer {
  startSpan(
    name: string,
    options?: { kind?: SpanKind; attributes?: SpanAttributes; traceId?: string },
  ): Span {
    const span = new NoopSpan(name, options?.traceId);
    if (options?.attributes) span.setAttributes(options.attributes);
    if (options?.kind) span.setAttribute("span.kind", options.kind);
    return span;
  }

  async withSpan<T>(
    name: string,
    fn: (span: Span) => Promise<T> | T,
    options?: { attributes?: SpanAttributes; traceId?: string },
  ): Promise<T> {
    const span = this.startSpan(name, options);
    try {
      const out = await fn(span);
      span.setStatus({ code: "ok" });
      return out;
    } catch (err) {
      span.recordException(err);
      throw err;
    } finally {
      span.end();
    }
  }
}

let activeTracer: Tracer = new NoopTracer();

/** Substituir em Sprint 5.4 quando OTel real for adicionado. */
export function setTracer(tracer: Tracer): void {
  activeTracer = tracer;
}

export function getTracer(): Tracer {
  return activeTracer;
}
