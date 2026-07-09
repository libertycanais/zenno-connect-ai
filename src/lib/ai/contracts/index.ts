// EPIC A — Zenno Brain · Central contracts hub (additive, re-export only)
// Public contract surface consumed by Brain modules (Planner, Rules, Workflow,
// Decision Graph, Timeline, Recommendation, Artifact Store, etc). This file
// NEVER redefines existing types — it re-exports them so downstream code has
// a single, stable import path: `@/lib/ai/contracts`.
//
// Architecture Freeze v1.0: COMPATIBLE. No provider access. No I/O.

// ── Governance (Wave 5 contracts) ───────────────────────────────────────────
export type {
  DecisionTrace, DecisionTraceStep,
  RuleRef, RuleRecord, RuleRegistry,
  ContextSnapshot, ContextSnapshotStore,
  WorkflowFingerprint,
  RecommendationDimension, RecommendationScoreBreakdown,
  SkillManifest,
  PlannerStepPreview, PlannerDryRun,
  AICostForecast,
  ArtifactRef, ArtifactLineageNode, ArtifactLineageStore,
  ConfidenceThresholdPolicy, ConfidenceEvaluation,
  GovernanceEnvelope,
} from "../governance/types";

// ── Provider / Runtime ──────────────────────────────────────────────────────
export type {
  AIProviderName, AIAgent, TaskType, TaskStatus, AIMessageRole,
  NormalizedAIError, PolicyDecision, AIProviderCredentialSafe,
} from "../types";

export type {
  ProviderDescriptor, ModelDescriptor, ProviderStatus,
} from "../registry";

export type {
  SelectionInput, SelectionResult, SelectionCandidate, SelectionRequirements,
} from "../selection";

export type {
  AIProviderAdapter, AdapterRequest, AdapterResponse,
} from "../provider-adapter";

// ── Prompt / Explainability / Conversation ──────────────────────────────────
export type {
  Explainability, ExplainedResponse, SourceRef,
} from "../explainability";

export type {
  ConversationStore, ConversationRow, PersistedMessage,
} from "../conversation";

// ── Skills / Tools ──────────────────────────────────────────────────────────
export type {
  SkillDescriptor, SkillCategory,
} from "../skills";

export type {
  ToolDescriptor, ToolCall, ToolResult, ToolExecutor,
} from "../tools";

// ── Context (Wave 2) ────────────────────────────────────────────────────────
export type {
  BusinessContext, ContextMeta, ContextModuleName, WithMeta,
  OrganizationSlice, TeamSlice, BillingSlice, TrackingSlice, AdsSlice,
  CrmSlice, AnalyticsSlice, FinanceSlice, ExecutiveSlice, WhatsAppSlice,
  MemorySlice, ConversationSlice,
} from "../context/types";

// ── Brain contracts (defined below, exported by name) ───────────────────────
export type {
  Plan, PlanStep, PlanRequest, PlanConstraints, PlanKind, PlanStatus,
} from "./planner";

export type {
  BusinessRule, RuleContext, RuleEvaluation, RuleOutcome, RuleSeverity,
  RulesEngineReport,
} from "./rules";

export type {
  Workflow, WorkflowStep, WorkflowStepStatus, WorkflowBuildOptions,
} from "./workflow";

export type {
  DecisionGraph, DecisionNode, DecisionEdge, DecisionNodeKind, DecisionEdgeKind,
} from "./decision";

export type {
  TimelineEntry, TimelineStage, TimelineWrite,
} from "./timeline";

export type {
  FeatureFlagKey, FeatureFlagContext, FeatureFlagRule, FeatureFlagSnapshot,
} from "./feature-flags";

export type {
  TelemetryEventName, TelemetryEvent, TelemetrySink,
} from "./telemetry";

export type {
  CapabilityRow, CapabilityQuery, CapabilityMatch,
} from "./capability";

export type {
  Artifact, ArtifactKind,
} from "./artifact";

export type {
  Recommendation, RecommendationKind,
} from "./recommendation";
