// EPIC K — Security Telemetry
// 10 canonical events feed the Monitoring Engine bridge (org-scoped).
import type { SecurityTelemetryEvent, SecurityTelemetryEventName, OrgScoped } from "./types";

export interface SecurityTelemetrySink {
  emit(event: SecurityTelemetryEvent): void | Promise<void>;
}

export class InMemorySecurityTelemetrySink implements SecurityTelemetrySink {
  readonly events: SecurityTelemetryEvent[] = [];
  emit(event: SecurityTelemetryEvent): void { this.events.push(event); }
  clear(): void { this.events.length = 0; }
  count(name: SecurityTelemetryEventName): number {
    return this.events.filter((e) => e.name === name).length;
  }
  byOrg(orgId: string): SecurityTelemetryEvent[] {
    return this.events.filter((e) => e.organizationId === orgId);
  }
}

const SEVERITY_BY_EVENT: Record<SecurityTelemetryEventName, SecurityTelemetryEvent["severity"]> = {
  widget_loaded: "info",
  widget_denied: "warn",
  plugin_rejected: "warn",
  snapshot_loaded: "info",
  snapshot_invalid: "critical",
  share_created: "info",
  share_revoked: "warn",
  realtime_denied: "warn",
  permission_denforced: "warn",
  command_palette_denied: "warn",
};

let counter = 0;
function nextId(): string { counter += 1; return `sec_${Date.now()}_${counter}`; }

export class SecurityTelemetryEmitter {
  constructor(private readonly sink: SecurityTelemetrySink = new InMemorySecurityTelemetrySink()) {}

  emit(input: OrgScoped & {
    name: SecurityTelemetryEventName;
    userId?: string | null;
    workspaceId?: string | null;
    refs?: string[];
    meta?: Record<string, unknown>;
  }): SecurityTelemetryEvent {
    const evt: SecurityTelemetryEvent = {
      id: nextId(),
      organizationId: input.organizationId,
      name: input.name,
      userId: input.userId ?? null,
      workspaceId: input.workspaceId ?? null,
      refs: input.refs ?? [],
      severity: SEVERITY_BY_EVENT[input.name],
      meta: input.meta ?? {},
      occurredAt: new Date().toISOString(),
    };
    void this.sink.emit(evt);
    return evt;
  }

  getSink(): SecurityTelemetrySink { return this.sink; }
}

export const SECURITY_TELEMETRY_EVENTS: readonly SecurityTelemetryEventName[] = [
  "widget_loaded", "widget_denied", "plugin_rejected",
  "snapshot_loaded", "snapshot_invalid",
  "share_created", "share_revoked",
  "realtime_denied", "permission_denforced", "command_palette_denied",
] as const;
