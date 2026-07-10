// EPIC K.1 — Workspace Persistence · Shared contracts
// 100% additive. Organization-scoped. No I/O at this layer.

export type OrgScoped = { organizationId: string };

export type PersistedLayout = OrgScoped & {
  id: string;
  workspaceId: string;
  name: string;
  grid: { columns: number };
  widgets: any[];
  positions: Record<string, any>;
  sizes: Record<string, any>;
  visibility: Record<string, boolean>;
  collapsed: Record<string, boolean>;
  theme: string | null;
  density: string | null;
  layoutVersion: number;
  version: number;
  metadata: Record<string, any>;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
};

export type PersistedWidget = OrgScoped & {
  id: string;
  layoutId: string | null;
  workspaceId: string;
  instanceId: string;
  manifestId: string;
  manifestVersion: string;
  size: string;
  position: number;
  visible: boolean;
  collapsed: boolean;
  props: Record<string, any>;
  version: number;
  metadata: Record<string, any>;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
};

export type PersistedPreferences = OrgScoped & {
  id: string;
  userId: string;
  theme: string | null;
  density: string | null;
  sidebar: Record<string, any>;
  shortcuts: Record<string, string>;
  preferences: Record<string, any>;
  version: number;
  metadata: Record<string, any>;
  createdAt: string;
  updatedAt: string;
};

export type BookmarkKind =
  | "favorite" | "pinned_widget" | "pinned_report"
  | "pinned_recommendation" | "pinned_search" | "pinned_dashboard";

export type PersistedBookmark = OrgScoped & {
  id: string;
  userId: string;
  kind: BookmarkKind;
  refType: string;
  refId: string;
  label: string | null;
  position: number;
  version: number;
  metadata: Record<string, any>;
  createdAt: string;
  updatedAt: string;
};

export type PersistedSnapshot = OrgScoped & {
  id: string;
  workspaceId: string;
  snapshot: Record<string, any>;   // opaque, IDs only (no sensitive data)
  integrityHash: string;               // SHA-256
  schemaVersion: number;
  workspaceVersion: number;
  origin: string;                      // manual | auto | share | restore
  version: number;
  metadata: Record<string, any>;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
};

export type PersistedShareToken = OrgScoped & {
  id: string;
  workspaceId: string;
  snapshotId: string | null;
  tokenHash: string;                   // NEVER plaintext
  audience: "public_read" | "org_member" | "workspace_viewer";
  nonce: string;
  issuedAt: string;
  expiresAt: string;
  revokedAt: string | null;
  version: number;
  metadata: Record<string, any>;
  createdBy: string | null;
  createdAt: string;
};

export type PersistedFeatureFlag = OrgScoped & {
  id: string;
  widget: string;
  flag: string;
  enabled: boolean;
  scope: string;
  rollout: number;
  version: number;
  metadata: Record<string, any>;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
};

export type RecentItemType =
  | "report" | "dashboard" | "search" | "insight"
  | "recommendation" | "timeline" | "workspace" | "widget";

export type PersistedRecentItem = OrgScoped & {
  id: string;
  userId: string;
  itemType: RecentItemType;
  itemRef: string;
  label: string | null;
  visitedAt: string;
  version: number;
  metadata: Record<string, any>;
  createdAt: string;
  updatedAt: string;
};

export type PersistedDashboard = OrgScoped & {
  id: string;
  workspaceId: string;
  layoutId: string | null;
  name: string;
  description: string | null;
  isDefault: boolean;
  version: number;
  metadata: Record<string, any>;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
};
