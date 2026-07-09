// FEATURE P0.6 — Onda 5 · Governance Contracts (additive scaffolding)
// Pure types + interfaces for the 10 governance primitives. Implementations
// belong to Onda 5+ (Brain / Rules / Planner / Recommendation / Artifact
// Store). This file NEVER touches Provider Layer, RLS, contracts or schema.
//
// Architecture Freeze v1.0: COMPATIBLE. No runtime side-effects. No I/O.

import type { AIAgent, AIProviderName } from "../types";
import type { ContextModuleName } from "../context/types";

// ── 1. Decision Trace ───────────────────────────────────────────────────────
/** Deterministic, append-only trace of every step the Brain/Planner took. */
export type DecisionTraceStep = {
  at: string;
  stage: "policy" | "context" | "plan" | "select" | "call" | "validate" | "post" | "rule";
  actor: string;                 // module id (e.g. "planner", "rules-engine")
  input: Record<string, unknown> | null;
  output: Record<string, unknown> | null;
  decision: string;              // human-readable outcome
  reasonCode: string;            // machine-readable code
  costCents?: number;
  latencyMs?: number;
};

export type DecisionTrace = {
  traceId: string;
  organizationId: string;
  userId: string;
  agent: AIAgent;
  startedAt: string;
  finishedAt: string | null;
  steps: DecisionTraceStep[];
  outcome: "success" | "failure" | "aborted" | "partial";
};

// ── 2. Rule Versioning ──────────────────────────────────────────────────────
export type RuleRef = { key: string; version: string; fingerprint: string };

export type RuleRecord = {
  key: string;
  version: string;               // semver
  fingerprint: string;           // sha256 of body, 16 hex
  body: string;                  // rule DSL / prompt / expression
  createdAt: string;
  active: boolean;
};

export interface RuleRegistry {
  register(key: string, version: string, body: string): Promise<RuleRecord>;
  activate(key: string, version: string): void;
  active(key: string): RuleRecord | undefined;
  history(key: string): RuleRecord[];
  ref(key: string): RuleRef | undefined;
}

// ── 3. Context Snapshot ─────────────────────────────────────────────────────
/** Immutable pointer to the exact BusinessContext used in one call. */
export type ContextSnapshot = {
  snapshotId: string;
  organizationId: string;
  agent: AIAgent;
  takenAt: string;
  modules: ContextModuleName[];
  tokensEstimated: number;
  fingerprint: string;           // sha256 over reduced context
  ttlSeconds: number;
};

export interface ContextSnapshotStore {
  put(snapshot: ContextSnapshot, body: string): Promise<void>;
  get(snapshotId: string): Promise<{ snapshot: ContextSnapshot; body: string } | null>;
}

// ── 4. Workflow Fingerprint ─────────────────────────────────────────────────
/** Stable hash of a workflow definition — used for replay + cache lookup. */
export type WorkflowFingerprint = {
  workflowKey: string;
  version: string;
  fingerprint: string;
  nodeCount: number;
  createdAt: string;
};

export function fingerprintInputShape(_shape: unknown): string {
  // Implementation lands with the Workflow Engine (Onda 5+). Contract only.
  throw new Error("fingerprintInputShape: not implemented (Onda 5+)");
}

// ── 5. Recommendation Score Breakdown ───────────────────────────────────────
export type RecommendationDimension =
  | "impact" | "confidence" | "effort" | "risk" | "urgency" | "cost" | "coverage";

export type RecommendationScoreBreakdown = {
  total: number;                 // 0..1
  dimensions: Record<RecommendationDimension, number>; // 0..1 each
  weights: Record<RecommendationDimension, number>;    // sum should be ~1
  explanation: string;
  computedAt: string;
};

// ── 6. Skill Manifest ───────────────────────────────────────────────────────
/** Signed capability declaration a skill must satisfy before being invoked. */
export type SkillManifest = {
  skillId: string;
  version: string;
  fingerprint: string;
  requiredContext: ContextModuleName[];
  requiredTools: string[];
  requiredCapabilities: Array<"reasoning" | "vision" | "tools" | "streaming">;
  suggestedModels: string[];
  costBudgetCents: number;
  latencyBudgetMs: number;
  policyTags: string[];          // e.g. ["pii-safe", "billing-read-only"]
};

// ── 7. Planner Dry Run ──────────────────────────────────────────────────────
export type PlannerStepPreview = {
  index: number;
  skillId: string;
  estimatedInputTokens: number;
  estimatedOutputTokens: number;
  estimatedCostCents: number;
  estimatedLatencyMs: number;
  requires: ContextModuleName[];
  produces: string[];            // artifact ids
};

export type PlannerDryRun = {
  planId: string;
  agent: AIAgent;
  steps: PlannerStepPreview[];
  totalCostCents: number;
  totalLatencyMs: number;
  totalTokens: number;
  warnings: string[];            // budget/policy hints; never blocks
  createdAt: string;
};

// ── 8. AI Cost Forecast ─────────────────────────────────────────────────────
export type AICostForecast = {
  windowDays: number;
  projectedCallCount: number;
  projectedCostCents: number;
  perProvider: Array<{ provider: AIProviderName; costCents: number; callCount: number }>;
  perAgent: Array<{ agent: AIAgent; costCents: number }>;
  confidence: number;            // 0..1
  method: "naive-mean" | "ewma" | "linreg";
  generatedAt: string;
};

// ── 9. Artifact Lineage ─────────────────────────────────────────────────────
export type ArtifactRef = { artifactId: string; kind: string; version: number };

export type ArtifactLineageNode = {
  artifact: ArtifactRef;
  producedBy: {
    traceId: string;
    stepIndex: number;
    skillId: string | null;
    model: string | null;
  };
  inputs: ArtifactRef[];         // parent artifacts
  contextSnapshotId: string | null;
  ruleRefs: RuleRef[];
  createdAt: string;
};

export interface ArtifactLineageStore {
  record(node: ArtifactLineageNode): Promise<void>;
  ancestors(artifactId: string, depth?: number): Promise<ArtifactLineageNode[]>;
  descendants(artifactId: string, depth?: number): Promise<ArtifactLineageNode[]>;
}

// ── 10. Confidence Threshold ────────────────────────────────────────────────
export type ConfidenceThresholdPolicy = {
  agent: AIAgent;
  minConfidence: number;         // 0..1
  onBelow: "reject" | "escalate" | "annotate" | "retry-different-model";
  requireSources: boolean;
  maxStaleModules: number;       // how many "stale" context modules tolerated
};

export type ConfidenceEvaluation = {
  passed: boolean;
  confidence: number;
  policy: ConfidenceThresholdPolicy;
  reason: string;
};

// ── Governance envelope (composition helper for the future Brain) ───────────
/** Aggregate view returned by the Brain in Onda 5+. Additive & optional. */
export type GovernanceEnvelope = {
  trace: DecisionTrace;
  contextSnapshotId: string | null;
  workflowFingerprint: WorkflowFingerprint | null;
  planPreview: PlannerDryRun | null;
  scoreBreakdown: RecommendationScoreBreakdown | null;
  costForecast: AICostForecast | null;
  confidence: ConfidenceEvaluation | null;
  lineage: ArtifactRef[];
  rulesApplied: RuleRef[];
};
