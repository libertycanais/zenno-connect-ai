// EPIC K — Zenno OS · Shared contracts
// 100% additive. Organization-scoped. No I/O. No provider access.
// Aligned with docs/security/EPIC_K_ZENNO_OS_SECURITY.md and CTO Addendum.

export type OrgScoped = { organizationId: string };

// ────────────────── Widget Manifest (Zero Trust) ──────────────────
export type WidgetCapability =
  | "search" | "realtime" | "notifications" | "reports"
  | "timeline" | "copilot" | "memory" | "forecast";

export type WidgetType =
  | "executive_score" | "kpis" | "forecast" | "timeline"
  | "signals" | "insights" | "recommendations" | "memory" | "experts";

export type WidgetPerformanceBudget = {
  maxLoadTimeMs: number;
  maxMemoryMb: number;
  maxRequests: number;
  cacheTtlSeconds: number;
  priority: 1 | 2 | 3 | 4 | 5;
};

export type WidgetManifest = {
  id: string;
  version: string;
  type: WidgetType;
  permissions: string[];
  requiredCapabilities: WidgetCapability[];
  allowedSignals: string[];
  allowedApis: string[];
  featureFlags: string[];
  performance: WidgetPerformanceBudget;
};

// ────────────────── Workspace + Integrity Hash ──────────────────
export type WorkspaceWidgetInstance = {
  instanceId: string;
  manifestId: string;
  manifestVersion: string;
  size: "sm" | "md" | "lg" | "xl";
  position: number;
  props?: Record<string, unknown>;
};

export type WorkspaceLayout = OrgScoped & {
  id: string;
  workspaceId: string;
  name: string;
  widgets: WorkspaceWidgetInstance[];
  updatedAt: string;
};

export type WorkspaceIntegrity = {
  sha256: string;
  version: number;
  schemaVersion: number;
  createdBy: string;
  organizationId: string;
  computedAt: string;
};

export type WorkspaceSnapshot = OrgScoped & {
  id: string;
  workspaceId: string;
  version: number;
  schemaVersion: number;
  createdBy: string;
  createdAt: string;
  widgets: WorkspaceWidgetInstance[];
  layout: { columns: number; theme?: string };
  integrity: WorkspaceIntegrity;
};

// ────────────────── Signed Share Tokens ──────────────────
export type ShareAudience = "public_read" | "org_member" | "workspace_viewer";

export type ShareTokenPayload = {
  audience: ShareAudience;
  organizationId: string;
  workspaceId: string;
  snapshotVersion: number;
  nonce: string;
  issuedAt: number;   // seconds
  expiresAt: number;  // seconds
};

export type SignedShareToken = {
  token: string;      // "<base64url(payload)>.<base64url(hmac)>"
  payload: ShareTokenPayload;
};

// ────────────────── Plugin Sandbox ──────────────────
export type PluginCapability = WidgetCapability;

export type PluginManifest = {
  id: string;
  version: string;
  name: string;
  vendor: string;
  capabilities: PluginCapability[];
  sandboxed: true;   // always iframe-sandboxed
  cspNonce?: string;
};

// ────────────────── Global Search ──────────────────
export type SearchModule =
  | "actions" | "recommendations" | "insights" | "reports"
  | "playbooks" | "memory" | "signals" | "widgets" | "workspaces";

export type SearchResult = {
  id: string;
  module: SearchModule;
  title: string;
  summary?: string;
  score: number;
  refs: string[];
};

export type SearchQuery = OrgScoped & {
  text: string;
  modules?: SearchModule[];
  filters?: Record<string, unknown>;
  userId: string;
};

export type SearchExplanation = {
  consultedModules: SearchModule[];
  ignoredModules: SearchModule[];
  filtersApplied: Record<string, unknown>;
  responseTimeMs: number;
  resultCount: number;
};

// ────────────────── Command Palette ──────────────────
export type CommandDefinition = {
  id: string;
  title: string;
  hint?: string;
  scope: "global" | "workspace" | "widget";
  requiredPermissions: string[];
  requiredCapabilities?: WidgetCapability[];
  featureFlag?: string;
  run: (ctx: { organizationId: string; userId: string; input?: string }) => Promise<{ ok: boolean; message?: string }>;
};

// ────────────────── Copilot Panel Transparency ──────────────────
export type CopilotTransparencyFrame = OrgScoped & {
  requestId: string;
  expert: string;
  model: string;
  provider: string;
  contextsLoaded: string[];
  memoriesUsed: string[];
  confidence: number;   // 0..1
  latencyMs: number;
  tokensPrompt: number;
  tokensCompletion: number;
  createdAt: string;
};

// ────────────────── Security Telemetry ──────────────────
export type SecurityTelemetryEventName =
  | "widget_loaded" | "widget_denied"
  | "plugin_rejected" | "snapshot_loaded" | "snapshot_invalid"
  | "share_created" | "share_revoked"
  | "realtime_denied" | "permission_denforced"
  | "command_palette_denied";

export type SecurityTelemetryEvent = OrgScoped & {
  id: string;
  name: SecurityTelemetryEventName;
  userId: string | null;
  workspaceId: string | null;
  refs: string[];
  severity: "info" | "warn" | "critical";
  meta: Record<string, unknown>;
  occurredAt: string;
};

// ────────────────── Realtime ──────────────────
export type RealtimeSubscription = OrgScoped & {
  channel: string;         // e.g. `workspace:${workspaceId}`
  userId: string;
  workspaceId: string;
  grantedCapabilities: WidgetCapability[];
  createdAt: string;
};

// ────────────────── Recovery ──────────────────
export type RecoveryOutcome = { ok: boolean; message: string };
