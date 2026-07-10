// EPIC K — Workspace-scoped Realtime authorization contract
import type { SecurityTelemetryEmitter } from "./security-telemetry";
import type { OrgScoped, RealtimeSubscription, WidgetCapability } from "./types";

export type RealtimeGrantInput = OrgScoped & {
  workspaceId: string;
  userId: string;
  requestedCapabilities: WidgetCapability[];
  allowedCapabilities: WidgetCapability[];  // resolved from user's role/plan
};

export type RealtimeGrantResult =
  | { ok: true; subscription: RealtimeSubscription }
  | { ok: false; reason: "capability_denied" | "cross_org" };

export class RealtimeAuthorizer {
  constructor(private readonly telemetry: SecurityTelemetryEmitter) {}

  authorize(i: RealtimeGrantInput): RealtimeGrantResult {
    const denied = i.requestedCapabilities.find((c) => !i.allowedCapabilities.includes(c));
    if (denied) {
      this.telemetry.emit({
        organizationId: i.organizationId, workspaceId: i.workspaceId, userId: i.userId,
        name: "realtime_denied", refs: [], meta: { denied },
      });
      return { ok: false, reason: "capability_denied" };
    }
    return {
      ok: true,
      subscription: {
        organizationId: i.organizationId,
        workspaceId: i.workspaceId,
        userId: i.userId,
        channel: `workspace:${i.workspaceId}`,
        grantedCapabilities: i.requestedCapabilities,
        createdAt: new Date().toISOString(),
      },
    };
  }
}
