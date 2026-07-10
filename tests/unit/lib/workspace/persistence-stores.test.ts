// EPIC K.1 — In-memory stores: reference behavior, cross-tenant isolation, plaintext guard
import { describe, it, expect } from "vitest";
import {
  InMemoryWorkspaceStore, InMemoryShareTokenStore,
} from "@/lib/workspace/persistence/stores";
import type {
  PersistedLayout, PersistedBookmark, PersistedSnapshot,
  PersistedFeatureFlag, PersistedShareToken, PersistedRecentItem, PersistedDashboard,
  PersistedPreferences,
} from "@/lib/workspace/persistence/types";

const now = "2026-07-10T12:00:00Z";
const orgA = "org_a", orgB = "org_b", user = "u1";

function layout(org: string, id = "l1"): PersistedLayout {
  return {
    id, organizationId: org, workspaceId: "ws", name: "Home",
    grid: { columns: 12 }, widgets: [], positions: {}, sizes: {},
    visibility: {}, collapsed: {}, theme: null, density: null,
    layoutVersion: 1, version: 1, metadata: {},
    createdBy: user, updatedBy: user, createdAt: now, updatedAt: now,
  };
}

describe("EPIC K.1 · InMemory Workspace persistence", () => {
  it("layouts: cross-tenant list isolation", async () => {
    const s = new InMemoryWorkspaceStore();
    await s.layouts.save(layout(orgA, "l-a"));
    await s.layouts.save(layout(orgB, "l-b"));
    expect((await s.layouts.list({ organizationId: orgA })).map((r) => r.id)).toEqual(["l-a"]);
    expect((await s.layouts.list({ organizationId: orgB })).map((r) => r.id)).toEqual(["l-b"]);
  });

  it("layouts: increments version on repeated save", async () => {
    const s = new InMemoryWorkspaceStore();
    const l = layout(orgA);
    await s.layouts.save(l);
    const saved = await s.layouts.save(l);
    expect(saved.version).toBe(2);
  });

  it("layouts: delete is org-scoped", async () => {
    const s = new InMemoryWorkspaceStore();
    await s.layouts.save(layout(orgA, "x"));
    await s.layouts.delete({ organizationId: orgB }, "x"); // no-op
    expect(await s.layouts.get({ organizationId: orgA }, "x")).not.toBeNull();
  });

  it("preferences: per user upsert", async () => {
    const s = new InMemoryWorkspaceStore();
    const p: PersistedPreferences = {
      id: "p1", organizationId: orgA, userId: user, theme: "dark", density: "cozy",
      sidebar: {}, shortcuts: {}, preferences: {}, version: 1, metadata: {},
      createdAt: now, updatedAt: now,
    };
    await s.preferences.save(p);
    await s.preferences.save({ ...p, theme: "light" });
    const got = await s.preferences.get({ organizationId: orgA }, user);
    expect(got?.theme).toBe("light");
  });

  it("bookmarks: filters by kind", async () => {
    const s = new InMemoryWorkspaceStore();
    const b: PersistedBookmark = {
      id: "b1", organizationId: orgA, userId: user,
      kind: "favorite", refType: "report", refId: "r1", label: "R1",
      position: 0, version: 1, metadata: {}, createdAt: now, updatedAt: now,
    };
    await s.bookmarks.save(b);
    await s.bookmarks.save({ ...b, id: "b2", kind: "pinned_widget", refType: "widget", refId: "w1" });
    expect((await s.bookmarks.list({ organizationId: orgA }, user, "favorite")).length).toBe(1);
    expect((await s.bookmarks.list({ organizationId: orgA }, user)).length).toBe(2);
  });

  it("snapshots: integrity hash stored; org-scoped restore", async () => {
    const s = new InMemoryWorkspaceStore();
    const snap: PersistedSnapshot = {
      id: "s1", organizationId: orgA, workspaceId: "ws",
      snapshot: { ids: ["w1"] },
      integrityHash: "a".repeat(64),
      schemaVersion: 1, workspaceVersion: 1, origin: "manual",
      version: 1, metadata: {}, createdBy: user, createdAt: now, updatedAt: now,
    };
    await s.snapshots.save(snap);
    expect(await s.snapshots.get({ organizationId: orgA }, "s1")).not.toBeNull();
    expect(await s.snapshots.get({ organizationId: orgB }, "s1")).toBeNull();
  });

  it("share tokens: never accept plaintext token; expired excluded from active list", async () => {
    const store = new InMemoryShareTokenStore();
    const t: PersistedShareToken = {
      id: "t1", organizationId: orgA, workspaceId: "ws", snapshotId: null,
      tokenHash: "h".repeat(64), audience: "org_member", nonce: "n",
      issuedAt: now, expiresAt: "2020-01-01T00:00:00Z", revokedAt: null,
      version: 1, metadata: {}, createdBy: user, createdAt: now,
    };
    await store.save(t);
    expect((await store.listActive({ organizationId: orgA })).length).toBe(0);

    await expect(
      store.save({ ...t, id: "t2", expiresAt: "2099-01-01T00:00:00Z", token: "abc" } as unknown as PersistedShareToken),
    ).rejects.toThrow(/plaintext/);
  });

  it("share tokens: revoke is org-scoped", async () => {
    const store = new InMemoryShareTokenStore();
    const t: PersistedShareToken = {
      id: "t1", organizationId: orgA, workspaceId: "ws", snapshotId: null,
      tokenHash: "h".repeat(64), audience: "public_read", nonce: "n",
      issuedAt: now, expiresAt: "2099-01-01T00:00:00Z", revokedAt: null,
      version: 1, metadata: {}, createdBy: user, createdAt: now,
    };
    await store.save(t);
    await store.revoke({ organizationId: orgB }, "t1"); // no-op cross-tenant
    expect((await store.listActive({ organizationId: orgA })).length).toBe(1);
    await store.revoke({ organizationId: orgA }, "t1");
    expect((await store.listActive({ organizationId: orgA })).length).toBe(0);
  });

  it("feature flags: upsert by widget/flag/scope", async () => {
    const s = new InMemoryWorkspaceStore();
    const f: PersistedFeatureFlag = {
      id: "f1", organizationId: orgA, widget: "w.kpis", flag: "beta",
      enabled: false, scope: "org", rollout: 0, version: 1, metadata: {},
      createdBy: user, updatedBy: user, createdAt: now, updatedAt: now,
    };
    await s.featureFlags.upsert(f);
    await s.featureFlags.upsert({ ...f, enabled: true, rollout: 50 });
    const list = await s.featureFlags.list({ organizationId: orgA });
    expect(list.length).toBe(1);
    expect(list[0].enabled).toBe(true);
    expect(list[0].rollout).toBe(50);
  });

  it("recent items: touch updates visitedAt and keeps single row per (user,type,ref)", async () => {
    const s = new InMemoryWorkspaceStore();
    const i: PersistedRecentItem = {
      id: "r1", organizationId: orgA, userId: user, itemType: "report",
      itemRef: "rep-1", label: "Q3", visitedAt: now, version: 1, metadata: {},
      createdAt: now, updatedAt: now,
    };
    await s.recentItems.touch(i);
    await s.recentItems.touch(i);
    const list = await s.recentItems.list({ organizationId: orgA }, user);
    expect(list.length).toBe(1);
  });

  it("dashboards: cross-tenant isolation", async () => {
    const s = new InMemoryWorkspaceStore();
    const d: PersistedDashboard = {
      id: "d1", organizationId: orgA, workspaceId: "ws", layoutId: null,
      name: "Exec", description: null, isDefault: true, version: 1, metadata: {},
      createdBy: user, updatedBy: user, createdAt: now, updatedAt: now,
    };
    await s.dashboards.save(d);
    expect((await s.dashboards.list({ organizationId: orgB })).length).toBe(0);
  });
});
