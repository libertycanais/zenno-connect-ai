// EPIC K.1 — Workspace Persistence · Store interfaces + in-memory reference impls
// 100% additive. Pure domain — no Supabase imports here.
// Real Supabase-backed stores live in `supabase-stores.ts`.

import type {
  PersistedLayout, PersistedWidget, PersistedPreferences, PersistedBookmark,
  PersistedSnapshot, PersistedShareToken, PersistedFeatureFlag,
  PersistedRecentItem, PersistedDashboard, OrgScoped, BookmarkKind, RecentItemType,
} from "./types";

// ─── Interfaces ────────────────────────────────────────────────────────────
export interface LayoutStore {
  list(o: OrgScoped, workspaceId?: string): Promise<PersistedLayout[]>;
  get(o: OrgScoped, id: string): Promise<PersistedLayout | null>;
  save(l: PersistedLayout): Promise<PersistedLayout>;
  delete(o: OrgScoped, id: string): Promise<void>;
}

export interface WidgetStore {
  listByLayout(o: OrgScoped, layoutId: string): Promise<PersistedWidget[]>;
  save(w: PersistedWidget): Promise<PersistedWidget>;
  delete(o: OrgScoped, id: string): Promise<void>;
}

export interface PreferencesStore {
  get(o: OrgScoped, userId: string): Promise<PersistedPreferences | null>;
  save(p: PersistedPreferences): Promise<PersistedPreferences>;
}

export interface BookmarkStore {
  list(o: OrgScoped, userId: string, kind?: BookmarkKind): Promise<PersistedBookmark[]>;
  save(b: PersistedBookmark): Promise<PersistedBookmark>;
  remove(o: OrgScoped, id: string): Promise<void>;
}

export interface SnapshotStore {
  list(o: OrgScoped, workspaceId?: string, limit?: number): Promise<PersistedSnapshot[]>;
  get(o: OrgScoped, id: string): Promise<PersistedSnapshot | null>;
  save(s: PersistedSnapshot): Promise<PersistedSnapshot>;
  delete(o: OrgScoped, id: string): Promise<void>;
}

export interface ShareTokenStore {
  listActive(o: OrgScoped): Promise<PersistedShareToken[]>;
  save(t: PersistedShareToken): Promise<PersistedShareToken>;
  revoke(o: OrgScoped, id: string): Promise<void>;
  findByHash(o: OrgScoped, tokenHash: string): Promise<PersistedShareToken | null>;
}

export interface FeatureFlagStore {
  list(o: OrgScoped): Promise<PersistedFeatureFlag[]>;
  upsert(f: PersistedFeatureFlag): Promise<PersistedFeatureFlag>;
}

export interface RecentItemStore {
  list(o: OrgScoped, userId: string, type?: RecentItemType, limit?: number): Promise<PersistedRecentItem[]>;
  touch(i: PersistedRecentItem): Promise<PersistedRecentItem>;
}

export interface DashboardStore {
  list(o: OrgScoped, workspaceId?: string): Promise<PersistedDashboard[]>;
  get(o: OrgScoped, id: string): Promise<PersistedDashboard | null>;
  save(d: PersistedDashboard): Promise<PersistedDashboard>;
  delete(o: OrgScoped, id: string): Promise<void>;
}

export interface WorkspaceStore {
  layouts: LayoutStore;
  widgets: WidgetStore;
  preferences: PreferencesStore;
  bookmarks: BookmarkStore;
  snapshots: SnapshotStore;
  shareTokens: ShareTokenStore;
  featureFlags: FeatureFlagStore;
  recentItems: RecentItemStore;
  dashboards: DashboardStore;
}

// ─── In-memory reference implementations (for tests + fallback) ───────────
const scoped = <T extends OrgScoped>(rows: T[], o: OrgScoped): T[] =>
  rows.filter((r) => r.organizationId === o.organizationId);

export class InMemoryLayoutStore implements LayoutStore {
  private rows: PersistedLayout[] = [];
  async list(o: OrgScoped, workspaceId?: string) {
    return scoped(this.rows, o).filter((r) => !workspaceId || r.workspaceId === workspaceId);
  }
  async get(o: OrgScoped, id: string) {
    return scoped(this.rows, o).find((r) => r.id === id) ?? null;
  }
  async save(l: PersistedLayout) {
    const idx = this.rows.findIndex((r) => r.id === l.id && r.organizationId === l.organizationId);
    const next = { ...l, version: (idx >= 0 ? this.rows[idx].version + 1 : l.version), updatedAt: new Date().toISOString() };
    if (idx >= 0) this.rows[idx] = next; else this.rows.push(next);
    return next;
  }
  async delete(o: OrgScoped, id: string) {
    this.rows = this.rows.filter((r) => !(r.id === id && r.organizationId === o.organizationId));
  }
}

export class InMemoryWidgetStore implements WidgetStore {
  private rows: PersistedWidget[] = [];
  async listByLayout(o: OrgScoped, layoutId: string) {
    return scoped(this.rows, o).filter((r) => r.layoutId === layoutId).sort((a, b) => a.position - b.position);
  }
  async save(w: PersistedWidget) {
    const idx = this.rows.findIndex((r) => r.id === w.id && r.organizationId === w.organizationId);
    const next = { ...w, updatedAt: new Date().toISOString() };
    if (idx >= 0) this.rows[idx] = next; else this.rows.push(next);
    return next;
  }
  async delete(o: OrgScoped, id: string) {
    this.rows = this.rows.filter((r) => !(r.id === id && r.organizationId === o.organizationId));
  }
}

export class InMemoryPreferencesStore implements PreferencesStore {
  private rows: PersistedPreferences[] = [];
  async get(o: OrgScoped, userId: string) {
    return scoped(this.rows, o).find((r) => r.userId === userId) ?? null;
  }
  async save(p: PersistedPreferences) {
    const idx = this.rows.findIndex((r) => r.userId === p.userId && r.organizationId === p.organizationId);
    const next = { ...p, updatedAt: new Date().toISOString() };
    if (idx >= 0) this.rows[idx] = next; else this.rows.push(next);
    return next;
  }
}

export class InMemoryBookmarkStore implements BookmarkStore {
  private rows: PersistedBookmark[] = [];
  async list(o: OrgScoped, userId: string, kind?: BookmarkKind) {
    return scoped(this.rows, o)
      .filter((r) => r.userId === userId && (!kind || r.kind === kind))
      .sort((a, b) => a.position - b.position);
  }
  async save(b: PersistedBookmark) {
    const idx = this.rows.findIndex((r) =>
      r.userId === b.userId && r.kind === b.kind && r.refType === b.refType &&
      r.refId === b.refId && r.organizationId === b.organizationId);
    const next = { ...b, updatedAt: new Date().toISOString() };
    if (idx >= 0) this.rows[idx] = next; else this.rows.push(next);
    return next;
  }
  async remove(o: OrgScoped, id: string) {
    this.rows = this.rows.filter((r) => !(r.id === id && r.organizationId === o.organizationId));
  }
}

export class InMemorySnapshotStore implements SnapshotStore {
  private rows: PersistedSnapshot[] = [];
  async list(o: OrgScoped, workspaceId?: string, limit = 50) {
    return scoped(this.rows, o)
      .filter((r) => !workspaceId || r.workspaceId === workspaceId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, limit);
  }
  async get(o: OrgScoped, id: string) {
    return scoped(this.rows, o).find((r) => r.id === id) ?? null;
  }
  async save(s: PersistedSnapshot) {
    this.rows.push(s);
    return s;
  }
  async delete(o: OrgScoped, id: string) {
    this.rows = this.rows.filter((r) => !(r.id === id && r.organizationId === o.organizationId));
  }
}

export class InMemoryShareTokenStore implements ShareTokenStore {
  private rows: PersistedShareToken[] = [];
  async listActive(o: OrgScoped) {
    const now = new Date().toISOString();
    return scoped(this.rows, o).filter((r) => !r.revokedAt && r.expiresAt > now);
  }
  async save(t: PersistedShareToken) {
    // reject any accidental plaintext token (defensive)
    if ((t as unknown as { token?: string }).token) throw new Error("share_token_plaintext_forbidden");
    this.rows.push(t);
    return t;
  }
  async revoke(o: OrgScoped, id: string) {
    const idx = this.rows.findIndex((r) => r.id === id && r.organizationId === o.organizationId);
    if (idx >= 0) this.rows[idx] = { ...this.rows[idx], revokedAt: new Date().toISOString() };
  }
  async findByHash(o: OrgScoped, tokenHash: string) {
    return scoped(this.rows, o).find((r) => r.tokenHash === tokenHash) ?? null;
  }
}

export class InMemoryFeatureFlagStore implements FeatureFlagStore {
  private rows: PersistedFeatureFlag[] = [];
  async list(o: OrgScoped) { return scoped(this.rows, o); }
  async upsert(f: PersistedFeatureFlag) {
    const idx = this.rows.findIndex((r) =>
      r.widget === f.widget && r.flag === f.flag && r.scope === f.scope &&
      r.organizationId === f.organizationId);
    const next = { ...f, updatedAt: new Date().toISOString() };
    if (idx >= 0) this.rows[idx] = next; else this.rows.push(next);
    return next;
  }
}

export class InMemoryRecentItemStore implements RecentItemStore {
  private rows: PersistedRecentItem[] = [];
  async list(o: OrgScoped, userId: string, type?: RecentItemType, limit = 50) {
    return scoped(this.rows, o)
      .filter((r) => r.userId === userId && (!type || r.itemType === type))
      .sort((a, b) => b.visitedAt.localeCompare(a.visitedAt))
      .slice(0, limit);
  }
  async touch(i: PersistedRecentItem) {
    const idx = this.rows.findIndex((r) =>
      r.userId === i.userId && r.itemType === i.itemType && r.itemRef === i.itemRef &&
      r.organizationId === i.organizationId);
    const next = { ...i, visitedAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    if (idx >= 0) this.rows[idx] = next; else this.rows.push(next);
    return next;
  }
}

export class InMemoryDashboardStore implements DashboardStore {
  private rows: PersistedDashboard[] = [];
  async list(o: OrgScoped, workspaceId?: string) {
    return scoped(this.rows, o).filter((r) => !workspaceId || r.workspaceId === workspaceId);
  }
  async get(o: OrgScoped, id: string) {
    return scoped(this.rows, o).find((r) => r.id === id) ?? null;
  }
  async save(d: PersistedDashboard) {
    const idx = this.rows.findIndex((r) => r.id === d.id && r.organizationId === d.organizationId);
    const next = { ...d, updatedAt: new Date().toISOString() };
    if (idx >= 0) this.rows[idx] = next; else this.rows.push(next);
    return next;
  }
  async delete(o: OrgScoped, id: string) {
    this.rows = this.rows.filter((r) => !(r.id === id && r.organizationId === o.organizationId));
  }
}

export class InMemoryWorkspaceStore implements WorkspaceStore {
  layouts = new InMemoryLayoutStore();
  widgets = new InMemoryWidgetStore();
  preferences = new InMemoryPreferencesStore();
  bookmarks = new InMemoryBookmarkStore();
  snapshots = new InMemorySnapshotStore();
  shareTokens = new InMemoryShareTokenStore();
  featureFlags = new InMemoryFeatureFlagStore();
  recentItems = new InMemoryRecentItemStore();
  dashboards = new InMemoryDashboardStore();
}
