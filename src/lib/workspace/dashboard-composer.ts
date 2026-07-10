// EPIC K — Dashboard Composer v2 (org-scoped, versioned, integrity-verified)
import { computeIntegrity, verifyIntegrity } from "./integrity";
import { WidgetManifestRegistry } from "./manifest";
import { SecurityTelemetryEmitter } from "./security-telemetry";
import type {
  OrgScoped, WorkspaceLayout, WorkspaceSnapshot, WorkspaceWidgetInstance,
} from "./types";

const now = (): string => new Date().toISOString();

export type ComposerInput = OrgScoped & {
  workspaceId: string;
  layoutId: string;
  name: string;
  widgets: WorkspaceWidgetInstance[];
  createdBy: string;
  version: number;
  schemaVersion?: number;
  columns?: number;
  theme?: string;
};

export class DashboardComposerV2 {
  private layouts = new Map<string, WorkspaceLayout>();  // key: org:workspace:layout
  private snapshots = new Map<string, WorkspaceSnapshot>(); // key: snapshotId

  constructor(
    private readonly manifests: WidgetManifestRegistry,
    private readonly telemetry: SecurityTelemetryEmitter,
  ) {}

  private key(o: string, w: string, l: string): string { return `${o}::${w}::${l}`; }

  upsertLayout(i: ComposerInput): WorkspaceLayout {
    for (const w of i.widgets) {
      const m = this.manifests.get(w.manifestId, w.manifestVersion);
      if (!m) {
        this.telemetry.emit({
          organizationId: i.organizationId, name: "widget_denied",
          workspaceId: i.workspaceId, refs: [w.instanceId],
          meta: { reason: "unknown_manifest", manifestId: w.manifestId, version: w.manifestVersion },
        });
        throw new Error(`unknown_manifest:${w.manifestId}@${w.manifestVersion}`);
      }
    }
    const layout: WorkspaceLayout = {
      organizationId: i.organizationId, workspaceId: i.workspaceId,
      id: i.layoutId, name: i.name, widgets: i.widgets, updatedAt: now(),
    };
    this.layouts.set(this.key(i.organizationId, i.workspaceId, i.layoutId), layout);
    return layout;
  }

  getLayout(o: OrgScoped, workspaceId: string, layoutId: string): WorkspaceLayout | null {
    return this.layouts.get(this.key(o.organizationId, workspaceId, layoutId)) ?? null;
  }

  listLayouts(o: OrgScoped, workspaceId: string): WorkspaceLayout[] {
    return [...this.layouts.values()]
      .filter((l) => l.organizationId === o.organizationId && l.workspaceId === workspaceId);
  }

  snapshot(i: ComposerInput): WorkspaceSnapshot {
    this.upsertLayout(i);
    const base = {
      id: `snap_${i.workspaceId}_${i.version}_${Date.now()}`,
      workspaceId: i.workspaceId,
      organizationId: i.organizationId,
      version: i.version,
      schemaVersion: i.schemaVersion ?? 1,
      createdBy: i.createdBy,
      createdAt: now(),
      widgets: i.widgets,
      layout: { columns: i.columns ?? 12, theme: i.theme },
    };
    const integrity = computeIntegrity(base);
    const snapshot: WorkspaceSnapshot = { ...base, integrity };
    this.snapshots.set(snapshot.id, snapshot);
    this.telemetry.emit({
      organizationId: i.organizationId, workspaceId: i.workspaceId,
      name: "snapshot_loaded", refs: [snapshot.id],
      meta: { sha256: integrity.sha256, version: snapshot.version },
    });
    return snapshot;
  }

  loadSnapshot(o: OrgScoped, snapshotId: string): WorkspaceSnapshot {
    const s = this.snapshots.get(snapshotId);
    if (!s) throw new Error("snapshot_not_found");
    if (s.organizationId !== o.organizationId) {
      this.telemetry.emit({
        organizationId: o.organizationId, name: "snapshot_invalid",
        workspaceId: s.workspaceId, refs: [s.id], meta: { reason: "org_mismatch" },
      });
      throw new Error("org_mismatch");
    }
    const v = verifyIntegrity(s);
    if (!v.ok) {
      this.telemetry.emit({
        organizationId: o.organizationId, name: "snapshot_invalid",
        workspaceId: s.workspaceId, refs: [s.id], meta: { reason: v.reason ?? "invalid" },
      });
      throw new Error(`integrity_failed:${v.reason ?? "invalid"}`);
    }
    return s;
  }

  listSnapshots(o: OrgScoped, workspaceId: string): WorkspaceSnapshot[] {
    return [...this.snapshots.values()]
      .filter((s) => s.organizationId === o.organizationId && s.workspaceId === workspaceId)
      .sort((a, b) => b.version - a.version);
  }
}
