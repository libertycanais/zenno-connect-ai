// EPIC A — Zenno Brain · Telemetry (contracts + no-op sinks)
// No real dispatch is performed here — only in-memory buffering. Real sinks
// (observability metrics, audit log, Sentry) will be wired in a later Epic.

import type { TelemetryEvent, TelemetryEventName, TelemetrySink } from "../contracts/telemetry";

export * from "../contracts/telemetry";

let __telemetrySeq = 0;
function nextEventId(): string {
  __telemetrySeq = (__telemetrySeq + 1) % 1_000_000;
  return `tel_${Date.now().toString(36)}_${__telemetrySeq.toString(36)}`;
}

export class NoopTelemetrySink implements TelemetrySink {
  emit(_event: TelemetryEvent): void { /* intentional noop */ }
}

export class InMemoryTelemetrySink implements TelemetrySink {
  private buffer: TelemetryEvent[] = [];
  private readonly capacity: number;

  constructor(capacity = 1000) { this.capacity = capacity; }

  emit(event: TelemetryEvent): void {
    this.buffer.push(event);
    if (this.buffer.length > this.capacity) this.buffer.shift();
  }

  drain(): TelemetryEvent[] {
    const out = this.buffer; this.buffer = []; return out;
  }

  peek(name?: TelemetryEventName): TelemetryEvent[] {
    return name ? this.buffer.filter((e) => e.name === name) : [...this.buffer];
  }

  size(): number { return this.buffer.length; }
}

export function buildTelemetryEvent(
  name: TelemetryEventName,
  fields: Omit<Partial<TelemetryEvent>, "eventId" | "name" | "timestamp"> &
    Pick<TelemetryEvent, "organizationId" | "userId">,
): TelemetryEvent {
  return {
    eventId: nextEventId(),
    name,
    organizationId: fields.organizationId,
    userId: fields.userId,
    agent: fields.agent ?? null,
    provider: fields.provider ?? null,
    model: fields.model ?? null,
    planId: fields.planId ?? null,
    workflowId: fields.workflowId ?? null,
    taskId: fields.taskId ?? null,
    timestamp: new Date().toISOString(),
    latencyMs: fields.latencyMs ?? null,
    costCents: fields.costCents ?? null,
    meta: fields.meta ?? {},
  };
}

export const telemetry: TelemetrySink = new NoopTelemetrySink();
