// EPIC K.1 — CTO enhancements: versioning, migration, diff, sanitizer, GC
import { describe, it, expect } from "vitest";
import {
  WorkspaceVersionManager, SnapshotVersionManager, assertOptimistic,
  OptimisticLockError, WorkspaceMigrationEngine, WorkspaceExport, WorkspaceImport,
  sanitizeExport, WorkspaceDiff, SnapshotDiff, LayoutTemplates,
  WorkspaceValidator, WorkspaceRepair, SnapshotCompression, SnapshotGarbageCollector,
  IncrementalSnapshotBuilder, WorkspaceEventStore,
} from "@/lib/workspace/persistence/versioning";
import type { PersistedLayout, PersistedWidget, PersistedSnapshot } from "@/lib/workspace/persistence/types";

const now = "2026-07-10T12:00:00Z";
const org = "org_a", user = "u1";

const baseLayout = (over: Partial<PersistedLayout> = {}): PersistedLayout => ({
  id: "l1", organizationId: org, workspaceId: "ws", name: "Home",
  grid: { columns: 12 }, widgets: [], positions: {}, sizes: {},
  visibility: {}, collapsed: {}, theme: null, density: null,
  layoutVersion: 1, version: 1, metadata: {},
  createdBy: user, updatedBy: user, createdAt: now, updatedAt: now,
  ...over,
});

describe("EPIC K.1 · CTO enhancements", () => {
  it("version managers increment monotonically", () => {
    expect(new WorkspaceVersionManager().next(3)).toBe(4);
    expect(new SnapshotVersionManager().next(0)).toBe(1);
  });

  it("optimistic locking throws when versions mismatch", () => {
    expect(() => assertOptimistic(1, 2)).toThrow(OptimisticLockError);
    expect(() => assertOptimistic(2, 2)).not.toThrow();
  });

  it("migration engine applies steps in order", () => {
    const engine = new WorkspaceMigrationEngine<{ schemaVersion?: number; name: string }>();
    engine.register(1, (i) => ({ ...i, name: `${i.name}_v2` }));
    engine.register(2, (i) => ({ ...i, name: `${i.name}_v3` }));
    const out = engine.migrate({ schemaVersion: 1, name: "x" }, 3);
    expect(out.name).toBe("x_v2_v3");
    expect(out.schemaVersion).toBe(3);
  });

  it("sanitizer strips sensitive fields recursively", () => {
    const bundle = { api_key: "secret", nested: { token: "x", ok: "yes" }, ok: 1 };
    const out = sanitizeExport(bundle);
    expect(out).toEqual({ nested: { ok: "yes" }, ok: 1 });
  });

  it("import rescopes organizationId to the target org (no cross-tenant adoption)", () => {
    const exporter = new WorkspaceExport();
    const importer = new WorkspaceImport();
    const bundle = exporter.build({ organizationId: org }, [baseLayout()], [], []);
    const adopted = importer.adopt(bundle, { organizationId: "org_b" });
    expect(adopted.organizationId).toBe("org_b");
    expect(importer.validate(bundle).ok).toBe(true);
    expect(importer.validate({}).ok).toBe(false);
  });

  it("WorkspaceDiff detects added/removed/changed widgets", () => {
    const w = (id: string, over: Partial<PersistedWidget> = {}): PersistedWidget => ({
      id: `w-${id}`, organizationId: org, layoutId: "l1", workspaceId: "ws",
      instanceId: id, manifestId: "w.kpis", manifestVersion: "1.0.0",
      size: "md", position: 0, visible: true, collapsed: false, props: {},
      version: 1, metadata: {}, createdBy: user, updatedBy: user,
      createdAt: now, updatedAt: now, ...over,
    });
    const diff = new WorkspaceDiff().layouts(
      [w("i1"), w("i2")],
      [w("i2", { position: 5 }), w("i3")],
    );
    expect(diff.added.map((x) => x.instanceId)).toEqual(["i3"]);
    expect(diff.removed.map((x) => x.instanceId)).toEqual(["i1"]);
    expect(diff.changed.length).toBe(1);
  });

  it("SnapshotDiff compares by integrity hash", () => {
    const s: PersistedSnapshot = {
      id: "s", organizationId: org, workspaceId: "ws", snapshot: {},
      integrityHash: "a".repeat(64), schemaVersion: 1, workspaceVersion: 1,
      origin: "manual", version: 1, metadata: {}, createdBy: user,
      createdAt: now, updatedAt: now,
    };
    expect(new SnapshotDiff().compare(s, s).equal).toBe(true);
    expect(new SnapshotDiff().compare(s, { ...s, integrityHash: "b".repeat(64) }).equal).toBe(false);
  });

  it("layout templates catalog is non-empty", () => {
    expect(new LayoutTemplates().list().length).toBeGreaterThan(0);
    expect(new LayoutTemplates().get("tpl.exec")?.name).toBe("Executive");
  });

  it("validator + repair round-trip a broken layout", () => {
    const broken = baseLayout({ name: "", grid: { columns: -1 }, version: 0 });
    expect(new WorkspaceValidator().validateLayout(broken).length).toBeGreaterThan(0);
    const fixed = new WorkspaceRepair().repairLayout(broken);
    expect(new WorkspaceValidator().validateLayout(fixed).length).toBe(0);
  });

  it("snapshot compression produces deterministic SHA-256", () => {
    const c = new SnapshotCompression();
    expect(c.hash({ a: 1, b: [1, 2] })).toMatch(/^[a-f0-9]{64}$/);
    expect(c.hash({ a: 1 })).not.toEqual(c.hash({ a: 2 }));
  });

  it("GC selects old snapshots outside keep-latest window", () => {
    const gc = new SnapshotGarbageCollector();
    const mk = (id: string, at: string): PersistedSnapshot => ({
      id, organizationId: org, workspaceId: "ws", snapshot: {},
      integrityHash: id.padEnd(64, "0"), schemaVersion: 1, workspaceVersion: 1,
      origin: "auto", version: 1, metadata: {}, createdBy: user,
      createdAt: at, updatedAt: at,
    });
    const rows = [
      mk("new", "2026-07-10T00:00:00Z"),
      mk("old1", "2020-01-01T00:00:00Z"),
      mk("old2", "2020-02-01T00:00:00Z"),
    ];
    const dropped = gc.select(rows, { keepLatest: 1, maxAgeDays: 30 }, Date.parse("2026-07-10T00:00:00Z"));
    expect(dropped.map((r) => r.id).sort()).toEqual(["old1", "old2"]);
  });

  it("incremental snapshot references base hash", () => {
    const base: PersistedSnapshot = {
      id: "b", organizationId: org, workspaceId: "ws", snapshot: {},
      integrityHash: "b".repeat(64), schemaVersion: 1, workspaceVersion: 1,
      origin: "manual", version: 1, metadata: {}, createdBy: user,
      createdAt: now, updatedAt: now,
    };
    const inc = new IncrementalSnapshotBuilder().build(base, { changed: 1 });
    expect(inc.baseSnapshotId).toBe("b");
    expect(inc.baseHash).toBe(base.integrityHash);
  });

  it("event store is org-scoped and append-only", () => {
    const es = new WorkspaceEventStore();
    es.append({ id: "e1", organizationId: org, type: "layout.saved", occurredAt: now });
    es.append({ id: "e2", organizationId: "org_b", type: "layout.saved", occurredAt: now });
    expect(es.list({ organizationId: org }).length).toBe(1);
  });
});
