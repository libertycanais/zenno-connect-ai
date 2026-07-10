// EPIC K.1 — CTO Enhancements: Version managers, migration engine, diff, validator, repair
// 100% additive. Pure functions. Compatible with Architecture Freeze v1.0.

import { createHash } from "crypto";
import type {
  PersistedLayout, PersistedSnapshot, PersistedWidget, OrgScoped,
} from "./types";

// ─── Workspace / Snapshot Version Managers ────────────────────────────────
export class WorkspaceVersionManager {
  next(current: number): number { return (current || 0) + 1; }
  isConflict(local: number, remote: number): boolean { return local < remote; }
}
export class SnapshotVersionManager {
  next(current: number): number { return (current || 0) + 1; }
}

// ─── Optimistic Locking ───────────────────────────────────────────────────
export class OptimisticLockError extends Error {
  constructor(readonly expected: number, readonly actual: number) {
    super(`optimistic_lock:${expected}!=${actual}`);
  }
}
export function assertOptimistic(expected: number, actual: number): void {
  if (expected !== actual) throw new OptimisticLockError(expected, actual);
}

// ─── Workspace Migration Engine ───────────────────────────────────────────
export type MigrationFn<T> = (input: T) => T;
export class WorkspaceMigrationEngine<T extends { schemaVersion?: number }> {
  private steps = new Map<number, MigrationFn<T>>();
  register(fromVersion: number, fn: MigrationFn<T>): void { this.steps.set(fromVersion, fn); }
  migrate(input: T, targetVersion: number): T {
    let current = input;
    let v = current.schemaVersion ?? 1;
    while (v < targetVersion) {
      const step = this.steps.get(v);
      if (!step) throw new Error(`missing_migration_step:${v}`);
      current = { ...step(current), schemaVersion: v + 1 };
      v++;
    }
    return current;
  }
}

// ─── Workspace Export / Import / Sanitizer / Validator ───────────────────
const SENSITIVE_KEYS = new Set([
  "api_key", "apikey", "token", "access_token", "refresh_token", "secret",
  "password", "authorization", "cookie", "client_secret", "webhook_secret",
  "service_role_key", "api_key_ciphertext", "api_key_nonce",
]);

export function sanitizeExport<T extends Record<string, unknown>>(value: T): T {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value)) {
    if (SENSITIVE_KEYS.has(k.toLowerCase())) continue;
    if (v && typeof v === "object" && !Array.isArray(v)) {
      out[k] = sanitizeExport(v as Record<string, unknown>);
    } else out[k] = v;
  }
  return out as T;
}

export type WorkspaceExportBundle = {
  schemaVersion: number;
  exportedAt: string;
  organizationId: string;
  layouts: PersistedLayout[];
  dashboards: unknown[];
  featureFlags: unknown[];
};

export class WorkspaceExport {
  build(o: OrgScoped, layouts: PersistedLayout[], dashboards: unknown[], flags: unknown[]): WorkspaceExportBundle {
    return sanitizeExport({
      schemaVersion: 1, exportedAt: new Date().toISOString(),
      organizationId: o.organizationId, layouts, dashboards, featureFlags: flags,
    });
  }
}

export type ImportValidation = { ok: true } | { ok: false; error: string };

export class WorkspaceImport {
  validate(bundle: unknown): ImportValidation {
    if (!bundle || typeof bundle !== "object") return { ok: false, error: "not_an_object" };
    const b = bundle as Partial<WorkspaceExportBundle>;
    if (typeof b.schemaVersion !== "number") return { ok: false, error: "missing_schema_version" };
    if (typeof b.organizationId !== "string") return { ok: false, error: "missing_org" };
    if (!Array.isArray(b.layouts)) return { ok: false, error: "missing_layouts" };
    return { ok: true };
  }
  adopt(bundle: WorkspaceExportBundle, target: OrgScoped): WorkspaceExportBundle {
    // Re-scope on import: NEVER trust bundle.organizationId at target time.
    return { ...bundle, organizationId: target.organizationId };
  }
}

// ─── Workspace / Snapshot Diff ────────────────────────────────────────────
export type LayoutDiff = {
  added: PersistedWidget[]; removed: PersistedWidget[]; changed: Array<{ before: PersistedWidget; after: PersistedWidget }>;
};
export class WorkspaceDiff {
  layouts(before: PersistedWidget[], after: PersistedWidget[]): LayoutDiff {
    const idx = new Map(before.map((w) => [w.instanceId, w]));
    const added: PersistedWidget[] = [];
    const changed: Array<{ before: PersistedWidget; after: PersistedWidget }> = [];
    for (const a of after) {
      const b = idx.get(a.instanceId);
      if (!b) added.push(a);
      else if (JSON.stringify(b) !== JSON.stringify(a)) changed.push({ before: b, after: a });
      idx.delete(a.instanceId);
    }
    return { added, removed: [...idx.values()], changed };
  }
}
export class SnapshotDiff {
  compare(a: PersistedSnapshot, b: PersistedSnapshot): { equal: boolean; hashMatch: boolean } {
    return { equal: a.integrityHash === b.integrityHash, hashMatch: a.integrityHash === b.integrityHash };
  }
}

// ─── Layout Templates ─────────────────────────────────────────────────────
export type LayoutTemplate = {
  id: string; name: string; grid: { columns: number }; widgets: unknown[];
};
export class LayoutTemplates {
  private readonly templates: LayoutTemplate[] = [
    { id: "tpl.exec", name: "Executive", grid: { columns: 12 }, widgets: [] },
    { id: "tpl.marketing", name: "Marketing", grid: { columns: 12 }, widgets: [] },
    { id: "tpl.ops", name: "Operations", grid: { columns: 12 }, widgets: [] },
  ];
  list(): LayoutTemplate[] { return [...this.templates]; }
  get(id: string): LayoutTemplate | null { return this.templates.find((t) => t.id === id) ?? null; }
}

// ─── Validator + Repair ──────────────────────────────────────────────────
export type ValidationIssue = { field: string; problem: string };
export class WorkspaceValidator {
  validateLayout(l: PersistedLayout): ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    if (!l.organizationId) issues.push({ field: "organizationId", problem: "missing" });
    if (!l.workspaceId) issues.push({ field: "workspaceId", problem: "missing" });
    if (!l.name) issues.push({ field: "name", problem: "missing" });
    if (l.grid?.columns == null || l.grid.columns <= 0) issues.push({ field: "grid.columns", problem: "invalid" });
    if (l.version <= 0) issues.push({ field: "version", problem: "invalid" });
    return issues;
  }
}
export class WorkspaceRepair {
  repairLayout(l: PersistedLayout): PersistedLayout {
    return {
      ...l,
      name: l.name || "Untitled",
      grid: { columns: l.grid?.columns && l.grid.columns > 0 ? l.grid.columns : 12 },
      widgets: Array.isArray(l.widgets) ? l.widgets : [],
      version: l.version > 0 ? l.version : 1,
      metadata: l.metadata ?? {},
    };
  }
}

// ─── Snapshot Compression (JSON minify + hash-stable) ────────────────────
export class SnapshotCompression {
  compress(payload: unknown): string { return JSON.stringify(payload); }
  hash(payload: unknown): string {
    return createHash("sha256").update(this.compress(payload)).digest("hex");
  }
}

// ─── Snapshot Garbage Collector ──────────────────────────────────────────
export type GcPolicy = { keepLatest: number; maxAgeDays: number };
export class SnapshotGarbageCollector {
  select(rows: PersistedSnapshot[], policy: GcPolicy, now = Date.now()): PersistedSnapshot[] {
    const sorted = [...rows].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const keep = new Set(sorted.slice(0, policy.keepLatest).map((r) => r.id));
    const cutoff = now - policy.maxAgeDays * 24 * 3600 * 1000;
    return sorted.filter((r) => !keep.has(r.id) && new Date(r.createdAt).getTime() < cutoff);
  }
}

// ─── Incremental Snapshots ───────────────────────────────────────────────
export type IncrementalSnapshot = {
  baseSnapshotId: string; baseHash: string; delta: unknown; createdAt: string;
};
export class IncrementalSnapshotBuilder {
  build(base: PersistedSnapshot, current: unknown): IncrementalSnapshot {
    return {
      baseSnapshotId: base.id, baseHash: base.integrityHash,
      delta: current, createdAt: new Date().toISOString(),
    };
  }
}

// ─── Workspace Event Store (append-only, in-memory ref) ──────────────────
export type WorkspaceEvent = OrgScoped & {
  id: string; type: string; refId?: string; actorId?: string;
  occurredAt: string; payload?: Record<string, unknown>;
};
export class WorkspaceEventStore {
  private events: WorkspaceEvent[] = [];
  append(e: WorkspaceEvent): void { this.events.push(e); }
  list(o: OrgScoped, limit = 100): WorkspaceEvent[] {
    return this.events.filter((x) => x.organizationId === o.organizationId).slice(-limit);
  }
}
