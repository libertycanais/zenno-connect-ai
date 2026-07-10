// EPIC K.1 — Workspace Persistence · Supabase-backed stores
// 100% additive. RLS + FORCE RLS enforce isolation; we still filter by org defensively.

import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  LayoutStore, WidgetStore, PreferencesStore, BookmarkStore,
  SnapshotStore, ShareTokenStore, FeatureFlagStore, RecentItemStore,
  DashboardStore, WorkspaceStore,
} from "./stores";
import type {
  OrgScoped, PersistedLayout, PersistedWidget, PersistedPreferences,
  PersistedBookmark, PersistedSnapshot, PersistedShareToken,
  PersistedFeatureFlag, PersistedRecentItem, PersistedDashboard,
  BookmarkKind, RecentItemType,
} from "./types";

// Any-casted client — Database types are auto-regenerated after the migration is
// deployed; keep the file self-contained without depending on the new types.
type AnyClient = SupabaseClient<any, any, any>;
const orDie = (error: unknown, ctx: string): never => {
  throw new Error(`workspace_persistence_${ctx}:${(error as { message?: string })?.message ?? "unknown"}`);
};

// ─── Row mappers ──────────────────────────────────────────────────────────
const mapLayout = (r: any): PersistedLayout => ({
  id: r.id, organizationId: r.organization_id, workspaceId: r.workspace_id,
  name: r.name, grid: r.grid ?? { columns: 12 }, widgets: r.widgets ?? [],
  positions: r.positions ?? {}, sizes: r.sizes ?? {},
  visibility: r.visibility ?? {}, collapsed: r.collapsed ?? {},
  theme: r.theme, density: r.density,
  layoutVersion: r.layout_version, version: r.version,
  metadata: r.metadata ?? {}, createdBy: r.created_by, updatedBy: r.updated_by,
  createdAt: r.created_at, updatedAt: r.updated_at,
});

const mapWidget = (r: any): PersistedWidget => ({
  id: r.id, organizationId: r.organization_id, layoutId: r.layout_id,
  workspaceId: r.workspace_id, instanceId: r.instance_id,
  manifestId: r.manifest_id, manifestVersion: r.manifest_version,
  size: r.size, position: r.position, visible: r.visible, collapsed: r.collapsed,
  props: r.props ?? {}, version: r.version, metadata: r.metadata ?? {},
  createdBy: r.created_by, updatedBy: r.updated_by,
  createdAt: r.created_at, updatedAt: r.updated_at,
});

const mapPrefs = (r: any): PersistedPreferences => ({
  id: r.id, organizationId: r.organization_id, userId: r.user_id,
  theme: r.theme, density: r.density, sidebar: r.sidebar ?? {},
  shortcuts: r.shortcuts ?? {}, preferences: r.preferences ?? {},
  version: r.version, metadata: r.metadata ?? {},
  createdAt: r.created_at, updatedAt: r.updated_at,
});

const mapBookmark = (r: any): PersistedBookmark => ({
  id: r.id, organizationId: r.organization_id, userId: r.user_id,
  kind: r.kind, refType: r.ref_type, refId: r.ref_id,
  label: r.label, position: r.position, version: r.version,
  metadata: r.metadata ?? {}, createdAt: r.created_at, updatedAt: r.updated_at,
});

const mapSnapshot = (r: any): PersistedSnapshot => ({
  id: r.id, organizationId: r.organization_id, workspaceId: r.workspace_id,
  snapshot: r.snapshot ?? {}, integrityHash: r.integrity_hash,
  schemaVersion: r.schema_version, workspaceVersion: r.workspace_version,
  origin: r.origin, version: r.version, metadata: r.metadata ?? {},
  createdBy: r.created_by, createdAt: r.created_at, updatedAt: r.updated_at,
});

const mapShareToken = (r: any): PersistedShareToken => ({
  id: r.id, organizationId: r.organization_id, workspaceId: r.workspace_id,
  snapshotId: r.snapshot_id, tokenHash: r.token_hash,
  audience: r.audience, nonce: r.nonce, issuedAt: r.issued_at,
  expiresAt: r.expires_at, revokedAt: r.revoked_at,
  version: r.version, metadata: r.metadata ?? {},
  createdBy: r.created_by, createdAt: r.created_at,
});

const mapFlag = (r: any): PersistedFeatureFlag => ({
  id: r.id, organizationId: r.organization_id, widget: r.widget,
  flag: r.flag, enabled: r.enabled, scope: r.scope, rollout: r.rollout,
  version: r.version, metadata: r.metadata ?? {},
  createdBy: r.created_by, updatedBy: r.updated_by,
  createdAt: r.created_at, updatedAt: r.updated_at,
});

const mapRecent = (r: any): PersistedRecentItem => ({
  id: r.id, organizationId: r.organization_id, userId: r.user_id,
  itemType: r.item_type, itemRef: r.item_ref, label: r.label,
  visitedAt: r.visited_at, version: r.version, metadata: r.metadata ?? {},
  createdAt: r.created_at, updatedAt: r.updated_at,
});

const mapDashboard = (r: any): PersistedDashboard => ({
  id: r.id, organizationId: r.organization_id, workspaceId: r.workspace_id,
  layoutId: r.layout_id, name: r.name, description: r.description,
  isDefault: r.is_default, version: r.version, metadata: r.metadata ?? {},
  createdBy: r.created_by, updatedBy: r.updated_by,
  createdAt: r.created_at, updatedAt: r.updated_at,
});

// ─── Store implementations ────────────────────────────────────────────────
export class SupabaseLayoutStore implements LayoutStore {
  constructor(private readonly db: AnyClient) {}
  async list(o: OrgScoped, workspaceId?: string): Promise<PersistedLayout[]> {
    let q = this.db.from("workspace_layouts").select("*").eq("organization_id", o.organizationId);
    if (workspaceId) q = q.eq("workspace_id", workspaceId);
    const { data, error } = await q.order("updated_at", { ascending: false });
    if (error) orDie(error, "layouts_list");
    return (data ?? []).map(mapLayout);
  }
  async get(o: OrgScoped, id: string) {
    const { data, error } = await this.db.from("workspace_layouts").select("*")
      .eq("organization_id", o.organizationId).eq("id", id).maybeSingle();
    if (error) orDie(error, "layouts_get");
    return data ? mapLayout(data) : null;
  }
  async save(l: PersistedLayout) {
    const payload = {
      id: l.id, organization_id: l.organizationId, workspace_id: l.workspaceId,
      name: l.name, grid: l.grid, widgets: l.widgets, positions: l.positions,
      sizes: l.sizes, visibility: l.visibility, collapsed: l.collapsed,
      theme: l.theme, density: l.density, layout_version: l.layoutVersion,
      version: l.version, metadata: l.metadata,
      created_by: l.createdBy, updated_by: l.updatedBy,
    };
    const { data, error } = await this.db.from("workspace_layouts")
      .upsert(payload, { onConflict: "id" }).select().single();
    if (error) orDie(error, "layouts_save");
    return mapLayout(data);
  }
  async delete(o: OrgScoped, id: string) {
    const { error } = await this.db.from("workspace_layouts").delete()
      .eq("organization_id", o.organizationId).eq("id", id);
    if (error) orDie(error, "layouts_delete");
  }
}

export class SupabaseWidgetStore implements WidgetStore {
  constructor(private readonly db: AnyClient) {}
  async listByLayout(o: OrgScoped, layoutId: string) {
    const { data, error } = await this.db.from("workspace_widgets").select("*")
      .eq("organization_id", o.organizationId).eq("layout_id", layoutId)
      .order("position", { ascending: true });
    if (error) orDie(error, "widgets_list");
    return (data ?? []).map(mapWidget);
  }
  async save(w: PersistedWidget) {
    const payload = {
      id: w.id, organization_id: w.organizationId, layout_id: w.layoutId,
      workspace_id: w.workspaceId, instance_id: w.instanceId,
      manifest_id: w.manifestId, manifest_version: w.manifestVersion,
      size: w.size, position: w.position, visible: w.visible, collapsed: w.collapsed,
      props: w.props, version: w.version, metadata: w.metadata,
      created_by: w.createdBy, updated_by: w.updatedBy,
    };
    const { data, error } = await this.db.from("workspace_widgets")
      .upsert(payload, { onConflict: "id" }).select().single();
    if (error) orDie(error, "widgets_save");
    return mapWidget(data);
  }
  async delete(o: OrgScoped, id: string) {
    const { error } = await this.db.from("workspace_widgets").delete()
      .eq("organization_id", o.organizationId).eq("id", id);
    if (error) orDie(error, "widgets_delete");
  }
}

export class SupabasePreferencesStore implements PreferencesStore {
  constructor(private readonly db: AnyClient) {}
  async get(o: OrgScoped, userId: string) {
    const { data, error } = await this.db.from("workspace_preferences").select("*")
      .eq("organization_id", o.organizationId).eq("user_id", userId).maybeSingle();
    if (error) orDie(error, "prefs_get");
    return data ? mapPrefs(data) : null;
  }
  async save(p: PersistedPreferences) {
    const payload = {
      id: p.id, organization_id: p.organizationId, user_id: p.userId,
      theme: p.theme, density: p.density, sidebar: p.sidebar,
      shortcuts: p.shortcuts, preferences: p.preferences,
      version: p.version, metadata: p.metadata,
    };
    const { data, error } = await this.db.from("workspace_preferences")
      .upsert(payload, { onConflict: "organization_id,user_id" }).select().single();
    if (error) orDie(error, "prefs_save");
    return mapPrefs(data);
  }
}

export class SupabaseBookmarkStore implements BookmarkStore {
  constructor(private readonly db: AnyClient) {}
  async list(o: OrgScoped, userId: string, kind?: BookmarkKind) {
    let q = this.db.from("workspace_bookmarks").select("*")
      .eq("organization_id", o.organizationId).eq("user_id", userId);
    if (kind) q = q.eq("kind", kind);
    const { data, error } = await q.order("position", { ascending: true });
    if (error) orDie(error, "bookmarks_list");
    return (data ?? []).map(mapBookmark);
  }
  async save(b: PersistedBookmark) {
    const payload = {
      id: b.id, organization_id: b.organizationId, user_id: b.userId,
      kind: b.kind, ref_type: b.refType, ref_id: b.refId, label: b.label,
      position: b.position, version: b.version, metadata: b.metadata,
    };
    const { data, error } = await this.db.from("workspace_bookmarks")
      .upsert(payload, { onConflict: "organization_id,user_id,kind,ref_type,ref_id" })
      .select().single();
    if (error) orDie(error, "bookmarks_save");
    return mapBookmark(data);
  }
  async remove(o: OrgScoped, id: string) {
    const { error } = await this.db.from("workspace_bookmarks").delete()
      .eq("organization_id", o.organizationId).eq("id", id);
    if (error) orDie(error, "bookmarks_remove");
  }
}

export class SupabaseSnapshotStore implements SnapshotStore {
  constructor(private readonly db: AnyClient) {}
  async list(o: OrgScoped, workspaceId?: string, limit = 50) {
    let q = this.db.from("workspace_snapshots").select("*")
      .eq("organization_id", o.organizationId);
    if (workspaceId) q = q.eq("workspace_id", workspaceId);
    const { data, error } = await q.order("created_at", { ascending: false }).limit(limit);
    if (error) orDie(error, "snapshots_list");
    return (data ?? []).map(mapSnapshot);
  }
  async get(o: OrgScoped, id: string) {
    const { data, error } = await this.db.from("workspace_snapshots").select("*")
      .eq("organization_id", o.organizationId).eq("id", id).maybeSingle();
    if (error) orDie(error, "snapshots_get");
    return data ? mapSnapshot(data) : null;
  }
  async save(s: PersistedSnapshot) {
    const payload = {
      id: s.id, organization_id: s.organizationId, workspace_id: s.workspaceId,
      snapshot: s.snapshot, integrity_hash: s.integrityHash,
      schema_version: s.schemaVersion, workspace_version: s.workspaceVersion,
      origin: s.origin, version: s.version, metadata: s.metadata,
      created_by: s.createdBy,
    };
    const { data, error } = await this.db.from("workspace_snapshots")
      .upsert(payload, { onConflict: "id" }).select().single();
    if (error) orDie(error, "snapshots_save");
    return mapSnapshot(data);
  }
  async delete(o: OrgScoped, id: string) {
    const { error } = await this.db.from("workspace_snapshots").delete()
      .eq("organization_id", o.organizationId).eq("id", id);
    if (error) orDie(error, "snapshots_delete");
  }
}

export class SupabaseShareTokenStore implements ShareTokenStore {
  constructor(private readonly db: AnyClient) {}
  async listActive(o: OrgScoped) {
    const { data, error } = await this.db.from("workspace_share_tokens").select("*")
      .eq("organization_id", o.organizationId).is("revoked_at", null)
      .gt("expires_at", new Date().toISOString());
    if (error) orDie(error, "share_list");
    return (data ?? []).map(mapShareToken);
  }
  async save(t: PersistedShareToken) {
    if ((t as unknown as { token?: string }).token) throw new Error("share_token_plaintext_forbidden");
    const payload = {
      id: t.id, organization_id: t.organizationId, workspace_id: t.workspaceId,
      snapshot_id: t.snapshotId, token_hash: t.tokenHash,
      audience: t.audience, nonce: t.nonce, issued_at: t.issuedAt,
      expires_at: t.expiresAt, revoked_at: t.revokedAt,
      version: t.version, metadata: t.metadata, created_by: t.createdBy,
    };
    const { data, error } = await this.db.from("workspace_share_tokens")
      .upsert(payload, { onConflict: "id" }).select().single();
    if (error) orDie(error, "share_save");
    return mapShareToken(data);
  }
  async revoke(o: OrgScoped, id: string) {
    const { error } = await this.db.from("workspace_share_tokens")
      .update({ revoked_at: new Date().toISOString() })
      .eq("organization_id", o.organizationId).eq("id", id);
    if (error) orDie(error, "share_revoke");
  }
  async findByHash(o: OrgScoped, tokenHash: string) {
    const { data, error } = await this.db.from("workspace_share_tokens").select("*")
      .eq("organization_id", o.organizationId).eq("token_hash", tokenHash).maybeSingle();
    if (error) orDie(error, "share_find");
    return data ? mapShareToken(data) : null;
  }
}

export class SupabaseFeatureFlagStore implements FeatureFlagStore {
  constructor(private readonly db: AnyClient) {}
  async list(o: OrgScoped) {
    const { data, error } = await this.db.from("workspace_feature_flags").select("*")
      .eq("organization_id", o.organizationId);
    if (error) orDie(error, "flags_list");
    return (data ?? []).map(mapFlag);
  }
  async upsert(f: PersistedFeatureFlag) {
    const payload = {
      id: f.id, organization_id: f.organizationId, widget: f.widget,
      flag: f.flag, enabled: f.enabled, scope: f.scope, rollout: f.rollout,
      version: f.version, metadata: f.metadata,
      created_by: f.createdBy, updated_by: f.updatedBy,
    };
    const { data, error } = await this.db.from("workspace_feature_flags")
      .upsert(payload, { onConflict: "organization_id,widget,flag,scope" })
      .select().single();
    if (error) orDie(error, "flags_upsert");
    return mapFlag(data);
  }
}

export class SupabaseRecentItemStore implements RecentItemStore {
  constructor(private readonly db: AnyClient) {}
  async list(o: OrgScoped, userId: string, type?: RecentItemType, limit = 50) {
    let q = this.db.from("workspace_recent_items").select("*")
      .eq("organization_id", o.organizationId).eq("user_id", userId);
    if (type) q = q.eq("item_type", type);
    const { data, error } = await q.order("visited_at", { ascending: false }).limit(limit);
    if (error) orDie(error, "recent_list");
    return (data ?? []).map(mapRecent);
  }
  async touch(i: PersistedRecentItem) {
    const payload = {
      id: i.id, organization_id: i.organizationId, user_id: i.userId,
      item_type: i.itemType, item_ref: i.itemRef, label: i.label,
      visited_at: new Date().toISOString(),
      version: i.version, metadata: i.metadata,
    };
    const { data, error } = await this.db.from("workspace_recent_items")
      .upsert(payload, { onConflict: "organization_id,user_id,item_type,item_ref" })
      .select().single();
    if (error) orDie(error, "recent_touch");
    return mapRecent(data);
  }
}

export class SupabaseDashboardStore implements DashboardStore {
  constructor(private readonly db: AnyClient) {}
  async list(o: OrgScoped, workspaceId?: string) {
    let q = this.db.from("workspace_dashboards").select("*")
      .eq("organization_id", o.organizationId);
    if (workspaceId) q = q.eq("workspace_id", workspaceId);
    const { data, error } = await q.order("updated_at", { ascending: false });
    if (error) orDie(error, "dashboards_list");
    return (data ?? []).map(mapDashboard);
  }
  async get(o: OrgScoped, id: string) {
    const { data, error } = await this.db.from("workspace_dashboards").select("*")
      .eq("organization_id", o.organizationId).eq("id", id).maybeSingle();
    if (error) orDie(error, "dashboards_get");
    return data ? mapDashboard(data) : null;
  }
  async save(d: PersistedDashboard) {
    const payload = {
      id: d.id, organization_id: d.organizationId, workspace_id: d.workspaceId,
      layout_id: d.layoutId, name: d.name, description: d.description,
      is_default: d.isDefault, version: d.version, metadata: d.metadata,
      created_by: d.createdBy, updated_by: d.updatedBy,
    };
    const { data, error } = await this.db.from("workspace_dashboards")
      .upsert(payload, { onConflict: "id" }).select().single();
    if (error) orDie(error, "dashboards_save");
    return mapDashboard(data);
  }
  async delete(o: OrgScoped, id: string) {
    const { error } = await this.db.from("workspace_dashboards").delete()
      .eq("organization_id", o.organizationId).eq("id", id);
    if (error) orDie(error, "dashboards_delete");
  }
}

export class SupabaseWorkspaceStore implements WorkspaceStore {
  layouts: LayoutStore;
  widgets: WidgetStore;
  preferences: PreferencesStore;
  bookmarks: BookmarkStore;
  snapshots: SnapshotStore;
  shareTokens: ShareTokenStore;
  featureFlags: FeatureFlagStore;
  recentItems: RecentItemStore;
  dashboards: DashboardStore;
  constructor(db: AnyClient) {
    this.layouts = new SupabaseLayoutStore(db);
    this.widgets = new SupabaseWidgetStore(db);
    this.preferences = new SupabasePreferencesStore(db);
    this.bookmarks = new SupabaseBookmarkStore(db);
    this.snapshots = new SupabaseSnapshotStore(db);
    this.shareTokens = new SupabaseShareTokenStore(db);
    this.featureFlags = new SupabaseFeatureFlagStore(db);
    this.recentItems = new SupabaseRecentItemStore(db);
    this.dashboards = new SupabaseDashboardStore(db);
  }
}
