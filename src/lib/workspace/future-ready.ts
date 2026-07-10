// EPIC K — Future-Ready contracts (Multi-workspace, Templates, Shared/Team/Public dashboards)
// Contracts only. No implementation in this Epic.
import type { OrgScoped, WorkspaceLayout, WorkspaceSnapshot } from "./types";

export type WorkspaceTemplate = OrgScoped & {
  id: string;
  name: string;
  description: string;
  layout: Omit<WorkspaceLayout, "organizationId" | "workspaceId" | "id" | "updatedAt">;
  createdAt: string;
};

export type SharedDashboardScope = "team" | "org" | "public_read";

export type SharedDashboard = OrgScoped & {
  id: string;
  workspaceId: string;
  snapshotId: string;
  scope: SharedDashboardScope;
  audienceIds: string[];       // team ids or user ids (public: empty)
  publicReadOnly: boolean;
  createdBy: string;
  createdAt: string;
};

export interface WorkspaceTemplateStore {
  list(o: OrgScoped): Promise<WorkspaceTemplate[]>;
  save(t: WorkspaceTemplate): Promise<WorkspaceTemplate>;
  instantiate(o: OrgScoped, templateId: string, workspaceId: string): Promise<WorkspaceSnapshot>;
}

export interface SharedDashboardStore {
  list(o: OrgScoped): Promise<SharedDashboard[]>;
  share(d: SharedDashboard): Promise<SharedDashboard>;
  revoke(o: OrgScoped, id: string): Promise<void>;
}

export interface MultiWorkspaceRegistry {
  listWorkspaces(o: OrgScoped): Promise<Array<{ id: string; name: string; default: boolean }>>;
  createWorkspace(o: OrgScoped, name: string): Promise<{ id: string; name: string }>;
}
