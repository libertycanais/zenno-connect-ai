// EPIC K — Workspace Integrity Hash (SHA-256, org-scoped)
import { createHash } from "crypto";
import type { WorkspaceIntegrity, WorkspaceSnapshot } from "./types";

export type IntegrityInput = Omit<WorkspaceSnapshot, "integrity">;

/** Canonical serialization: sorted keys, no whitespace, org-scoped. */
function canonical(s: IntegrityInput): string {
  return JSON.stringify({
    id: s.id,
    workspaceId: s.workspaceId,
    organizationId: s.organizationId,
    version: s.version,
    schemaVersion: s.schemaVersion,
    createdBy: s.createdBy,
    layout: s.layout,
    widgets: [...s.widgets]
      .sort((a, b) => a.instanceId.localeCompare(b.instanceId))
      .map((w) => ({
        instanceId: w.instanceId,
        manifestId: w.manifestId,
        manifestVersion: w.manifestVersion,
        size: w.size,
        position: w.position,
        props: w.props ?? null,
      })),
  });
}

export function computeIntegrity(s: IntegrityInput): WorkspaceIntegrity {
  const sha256 = createHash("sha256").update(canonical(s)).digest("hex");
  return {
    sha256,
    version: s.version,
    schemaVersion: s.schemaVersion,
    createdBy: s.createdBy,
    organizationId: s.organizationId,
    computedAt: new Date().toISOString(),
  };
}

export function verifyIntegrity(s: WorkspaceSnapshot): { ok: boolean; reason?: string } {
  if (s.integrity.organizationId !== s.organizationId) {
    return { ok: false, reason: "org_mismatch" };
  }
  const recomputed = createHash("sha256").update(canonical(s)).digest("hex");
  if (recomputed !== s.integrity.sha256) return { ok: false, reason: "hash_mismatch" };
  if (s.integrity.version !== s.version) return { ok: false, reason: "version_mismatch" };
  if (s.integrity.schemaVersion !== s.schemaVersion) return { ok: false, reason: "schema_mismatch" };
  return { ok: true };
}
