// EPIC K — Zero-Trust Widget Runtime
// Loads a widget instance only after the manifest authorizes every requested action.
import type { ManifestAuthAction, WidgetManifestRegistry } from "./manifest";
import type { SecurityTelemetryEmitter } from "./security-telemetry";
import type { OrgScoped, WorkspaceWidgetInstance } from "./types";

export type WidgetLoadResult =
  | { ok: true; instanceId: string }
  | { ok: false; instanceId: string; reason: string };

export class ZeroTrustWidgetRuntime {
  constructor(
    private readonly manifests: WidgetManifestRegistry,
    private readonly telemetry: SecurityTelemetryEmitter,
  ) {}

  load(
    o: OrgScoped & { workspaceId: string; userId: string },
    w: WorkspaceWidgetInstance,
    requestedActions: ManifestAuthAction[] = [],
  ): WidgetLoadResult {
    const manifest = this.manifests.get(w.manifestId, w.manifestVersion);
    if (!manifest) {
      this.telemetry.emit({
        organizationId: o.organizationId, workspaceId: o.workspaceId, userId: o.userId,
        name: "widget_denied", refs: [w.instanceId], meta: { reason: "unknown_manifest" },
      });
      return { ok: false, instanceId: w.instanceId, reason: "unknown_manifest" };
    }
    for (const action of requestedActions) {
      if (!this.manifests.authorize(w.manifestId, w.manifestVersion, action)) {
        this.telemetry.emit({
          organizationId: o.organizationId, workspaceId: o.workspaceId, userId: o.userId,
          name: "widget_denied", refs: [w.instanceId], meta: { reason: "action_denied", action },
        });
        return { ok: false, instanceId: w.instanceId, reason: "action_denied" };
      }
    }
    this.telemetry.emit({
      organizationId: o.organizationId, workspaceId: o.workspaceId, userId: o.userId,
      name: "widget_loaded", refs: [w.instanceId],
      meta: { manifestId: manifest.id, version: manifest.version },
    });
    return { ok: true, instanceId: w.instanceId };
  }
}
