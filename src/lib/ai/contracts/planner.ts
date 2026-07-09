// EPIC A — Zenno Brain · Planner contracts
import type { AIAgent, AIProviderName } from "../types";
import type { ContextModuleName } from "../context/types";

export type PlanKind = "analysis" | "recommendation" | "forecast" | "workflow" | "chat";
export type PlanStatus = "draft" | "approved" | "executing" | "completed" | "failed" | "aborted";

export type PlanConstraints = {
  maxCostCents: number;
  maxLatencyMs: number;
  maxSteps: number;
  requiredCapabilities: Array<"reasoning" | "vision" | "tools" | "streaming">;
  allowedProviders?: AIProviderName[];
  forbiddenProviders?: AIProviderName[];
};

export type PlanRequest = {
  organizationId: string;
  userId: string;
  agent: AIAgent;
  kind: PlanKind;
  objective: string;                  // human intent (untrusted; sanitized before prompt)
  requiredContext: ContextModuleName[];
  constraints: PlanConstraints;
  priority: "low" | "normal" | "high" | "critical";
  featureFlags?: string[];            // flags active at planning time
};

export type PlanStep = {
  index: number;
  skillId: string;
  provider: AIProviderName | null;    // null when Skill Router will decide later
  model: string | null;
  priority: number;                   // 1..10 (higher first)
  dependsOn: number[];                // indexes of prerequisite steps
  estimatedInputTokens: number;
  estimatedOutputTokens: number;
  estimatedCostCents: number;
  estimatedLatencyMs: number;
  requiredCapabilities: Array<"reasoning" | "vision" | "tools" | "streaming">;
  producesArtifactKinds: string[];
};

export type Plan = {
  planId: string;
  organizationId: string;
  userId: string;
  agent: AIAgent;
  kind: PlanKind;
  status: PlanStatus;
  objective: string;
  createdAt: string;
  steps: PlanStep[];
  totalCostCents: number;
  totalLatencyMs: number;
  totalTokens: number;
  fingerprint: string;                // sha256(16) of normalized plan
  featureFlags: string[];
  reasonCodes: string[];              // planner decisions applied
};
