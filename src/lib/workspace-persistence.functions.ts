// EPIC K.1 — Workspace Persistence · Server functions (authenticated)
// All functions require Supabase auth; RLS + FORCE RLS enforce isolation.
// 100% additive — never touches existing contracts.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { SupabaseWorkspaceStore } from "@/lib/workspace/persistence/supabase-stores";
import type {
  PersistedLayout, PersistedSnapshot, PersistedBookmark,
  PersistedFeatureFlag, PersistedRecentItem, PersistedDashboard,
} from "@/lib/workspace/persistence/types";

// ── Helpers ───────────────────────────────────────────────────────────────
async function orgFor(ctx: { supabase: any; userId: string }): Promise<string> {
  const { data, error } = await ctx.supabase
    .from("profiles").select("organization_id").eq("id", ctx.userId).maybeSingle();
  if (error) throw new Error(`org_lookup:${error.message}`);
  if (!data?.organization_id) throw new Error("org_not_found");
  return data.organization_id as string;
}

const storeOf = (ctx: { supabase: any }) => new SupabaseWorkspaceStore(ctx.supabase);

// ── getWorkspace ──────────────────────────────────────────────────────────
export const getWorkspace = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) =>
    z.object({ workspaceId: z.string().min(1).default("default") }).parse(raw ?? {}))
  .handler(async ({ data, context }) => {
    const orgId = await orgFor(context);
    const store = storeOf(context);
    const [layouts, dashboards, prefs, flags] = await Promise.all([
      store.layouts.list({ organizationId: orgId }, data.workspaceId),
      store.dashboards.list({ organizationId: orgId }, data.workspaceId),
      store.preferences.get({ organizationId: orgId }, context.userId),
      store.featureFlags.list({ organizationId: orgId }),
    ]);
    return { organizationId: orgId, workspaceId: data.workspaceId, layouts, dashboards, preferences: prefs, featureFlags: flags };
  });

// ── saveWorkspace (bulk persist preferences + optional flag) ─────────────
const saveWorkspaceInput = z.object({
  theme: z.string().nullable().optional(),
  density: z.string().nullable().optional(),
  sidebar: z.record(z.unknown()).optional(),
  shortcuts: z.record(z.string()).optional(),
  preferences: z.record(z.unknown()).optional(),
});
export const saveWorkspace = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => saveWorkspaceInput.parse(raw))
  .handler(async ({ data, context }) => {
    const orgId = await orgFor(context);
    const now = new Date().toISOString();
    const p = await storeOf(context).preferences.save({
      id: crypto.randomUUID(), organizationId: orgId, userId: context.userId,
      theme: data.theme ?? null, density: data.density ?? null,
      sidebar: data.sidebar ?? {}, shortcuts: data.shortcuts ?? {},
      preferences: data.preferences ?? {}, version: 1, metadata: {},
      createdAt: now, updatedAt: now,
    });
    return { preferences: p };
  });

// ── Layouts ───────────────────────────────────────────────────────────────
export const listLayouts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) =>
    z.object({ workspaceId: z.string().optional() }).parse(raw ?? {}))
  .handler(async ({ data, context }) => {
    const orgId = await orgFor(context);
    return { layouts: await storeOf(context).layouts.list({ organizationId: orgId }, data.workspaceId) };
  });

const saveLayoutInput = z.object({
  id: z.string().uuid().optional(),
  workspaceId: z.string().min(1).default("default"),
  name: z.string().min(1),
  grid: z.object({ columns: z.number().int().positive() }).default({ columns: 12 }),
  widgets: z.array(z.unknown()).default([]),
  positions: z.record(z.unknown()).default({}),
  sizes: z.record(z.unknown()).default({}),
  visibility: z.record(z.boolean()).default({}),
  collapsed: z.record(z.boolean()).default({}),
  theme: z.string().nullable().optional(),
  density: z.string().nullable().optional(),
  layoutVersion: z.number().int().positive().default(1),
  version: z.number().int().positive().default(1),
  metadata: z.record(z.unknown()).default({}),
});
export const saveLayout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => saveLayoutInput.parse(raw))
  .handler(async ({ data, context }) => {
    const orgId = await orgFor(context);
    const now = new Date().toISOString();
    const layout: PersistedLayout = {
      id: data.id ?? crypto.randomUUID(),
      organizationId: orgId, workspaceId: data.workspaceId, name: data.name,
      grid: data.grid, widgets: data.widgets, positions: data.positions,
      sizes: data.sizes, visibility: data.visibility, collapsed: data.collapsed,
      theme: data.theme ?? null, density: data.density ?? null,
      layoutVersion: data.layoutVersion, version: data.version,
      metadata: data.metadata, createdBy: context.userId, updatedBy: context.userId,
      createdAt: now, updatedAt: now,
    };
    return { layout: await storeOf(context).layouts.save(layout) };
  });

export const deleteLayout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => z.object({ id: z.string().uuid() }).parse(raw))
  .handler(async ({ data, context }) => {
    const orgId = await orgFor(context);
    await storeOf(context).layouts.delete({ organizationId: orgId }, data.id);
    return { ok: true };
  });

// ── Snapshots ─────────────────────────────────────────────────────────────
export const listSnapshots = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) =>
    z.object({ workspaceId: z.string().optional(), limit: z.number().int().positive().max(200).optional() }).parse(raw ?? {}))
  .handler(async ({ data, context }) => {
    const orgId = await orgFor(context);
    return { snapshots: await storeOf(context).snapshots.list({ organizationId: orgId }, data.workspaceId, data.limit) };
  });

const createSnapshotInput = z.object({
  workspaceId: z.string().min(1).default("default"),
  snapshot: z.record(z.unknown()),          // opaque IDs only (validated by caller)
  integrityHash: z.string().regex(/^[a-f0-9]{64}$/),
  schemaVersion: z.number().int().positive().default(1),
  workspaceVersion: z.number().int().positive().default(1),
  origin: z.enum(["manual", "auto", "share", "restore"]).default("manual"),
  metadata: z.record(z.unknown()).default({}),
});
export const createSnapshot = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => createSnapshotInput.parse(raw))
  .handler(async ({ data, context }) => {
    const orgId = await orgFor(context);
    const now = new Date().toISOString();
    const snap: PersistedSnapshot = {
      id: crypto.randomUUID(), organizationId: orgId, workspaceId: data.workspaceId,
      snapshot: data.snapshot, integrityHash: data.integrityHash,
      schemaVersion: data.schemaVersion, workspaceVersion: data.workspaceVersion,
      origin: data.origin, version: 1, metadata: data.metadata,
      createdBy: context.userId, createdAt: now, updatedAt: now,
    };
    return { snapshot: await storeOf(context).snapshots.save(snap) };
  });

export const restoreSnapshot = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => z.object({ id: z.string().uuid() }).parse(raw))
  .handler(async ({ data, context }) => {
    const orgId = await orgFor(context);
    const snap = await storeOf(context).snapshots.get({ organizationId: orgId }, data.id);
    if (!snap) throw new Error("snapshot_not_found");
    return { snapshot: snap };
  });

// ── Bookmarks ────────────────────────────────────────────────────────────
export const listBookmarks = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => z.object({
    kind: z.enum(["favorite","pinned_widget","pinned_report","pinned_recommendation","pinned_search","pinned_dashboard"]).optional(),
  }).parse(raw ?? {}))
  .handler(async ({ data, context }) => {
    const orgId = await orgFor(context);
    return { bookmarks: await storeOf(context).bookmarks.list({ organizationId: orgId }, context.userId, data.kind) };
  });

const saveBookmarkInput = z.object({
  kind: z.enum(["favorite","pinned_widget","pinned_report","pinned_recommendation","pinned_search","pinned_dashboard"]),
  refType: z.string().min(1),
  refId: z.string().min(1),
  label: z.string().optional(),
  position: z.number().int().nonnegative().default(0),
});
export const saveBookmark = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => saveBookmarkInput.parse(raw))
  .handler(async ({ data, context }) => {
    const orgId = await orgFor(context);
    const now = new Date().toISOString();
    const b: PersistedBookmark = {
      id: crypto.randomUUID(), organizationId: orgId, userId: context.userId,
      kind: data.kind, refType: data.refType, refId: data.refId,
      label: data.label ?? null, position: data.position, version: 1, metadata: {},
      createdAt: now, updatedAt: now,
    };
    return { bookmark: await storeOf(context).bookmarks.save(b) };
  });

export const removeBookmark = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => z.object({ id: z.string().uuid() }).parse(raw))
  .handler(async ({ data, context }) => {
    const orgId = await orgFor(context);
    await storeOf(context).bookmarks.remove({ organizationId: orgId }, data.id);
    return { ok: true };
  });

// ── Recent Items ──────────────────────────────────────────────────────────
export const listRecentItems = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => z.object({
    itemType: z.enum(["report","dashboard","search","insight","recommendation","timeline","workspace","widget"]).optional(),
    limit: z.number().int().positive().max(200).optional(),
  }).parse(raw ?? {}))
  .handler(async ({ data, context }) => {
    const orgId = await orgFor(context);
    return { items: await storeOf(context).recentItems.list({ organizationId: orgId }, context.userId, data.itemType, data.limit) };
  });

// ── Feature Flags ─────────────────────────────────────────────────────────
export const listFeatureFlags = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const orgId = await orgFor(context);
    return { flags: await storeOf(context).featureFlags.list({ organizationId: orgId }) };
  });

const updateFlagInput = z.object({
  widget: z.string().min(1),
  flag: z.string().min(1),
  enabled: z.boolean(),
  scope: z.string().default("org"),
  rollout: z.number().int().min(0).max(100).default(0),
});
export const updateFeatureFlag = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => updateFlagInput.parse(raw))
  .handler(async ({ data, context }) => {
    const orgId = await orgFor(context);
    const now = new Date().toISOString();
    const f: PersistedFeatureFlag = {
      id: crypto.randomUUID(), organizationId: orgId,
      widget: data.widget, flag: data.flag, enabled: data.enabled,
      scope: data.scope, rollout: data.rollout, version: 1, metadata: {},
      createdBy: context.userId, updatedBy: context.userId,
      createdAt: now, updatedAt: now,
    };
    return { flag: await storeOf(context).featureFlags.upsert(f) };
  });
