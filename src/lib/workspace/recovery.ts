// EPIC K — Workspace Recovery contracts (Backup / Restore / Rollback / Migration)
// Lightweight, additive. Actual persistence is provided by future adapters.
import type { OrgScoped, RecoveryOutcome, WorkspaceSnapshot } from "./types";

export interface WorkspaceBackup {
  backup(o: OrgScoped, workspaceId: string): Promise<{ snapshotId: string; sha256: string }>;
}

export interface WorkspaceRestore {
  restore(o: OrgScoped, snapshotId: string): Promise<WorkspaceSnapshot>;
}

export interface WorkspaceRollback {
  rollback(o: OrgScoped, workspaceId: string, toVersion: number): Promise<WorkspaceSnapshot>;
}

export interface WorkspaceMigration {
  migrate(o: OrgScoped, fromSchema: number, toSchema: number): Promise<{ migratedCount: number } & RecoveryOutcome>;
}

/** Convenience aggregate; each field may be null if the runtime hasn't wired the adapter. */
export type WorkspaceRecoveryKit = {
  backup?: WorkspaceBackup;
  restore?: WorkspaceRestore;
  rollback?: WorkspaceRollback;
  migration?: WorkspaceMigration;
};
