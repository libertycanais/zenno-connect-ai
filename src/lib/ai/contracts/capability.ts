// EPIC A — Zenno Brain · Capability Matrix contracts
import type { AIProviderName, AIAgent } from "../types";

export type CapabilityRow = {
  provider: AIProviderName;
  model: string;
  skill: string;
  requiredPlan: string;                // minimum billing plan slug
  requiredRole: string;                // minimum RBAC role
  requiresRule: string | null;         // rule key that must pass
  supportsAgents: AIAgent[];
  costRankPerMTokCents: number;        // used for ordering
  latencyRankMs: number;               // used for ordering
  active: boolean;
};

export type CapabilityQuery = {
  skill: string;
  agent: AIAgent;
  plan: string;
  role: string;
  requiredCapabilities?: Array<"reasoning" | "vision" | "tools" | "streaming">;
  allowedProviders?: AIProviderName[];
};

export type CapabilityMatch = {
  provider: AIProviderName;
  model: string;
  skill: string;
  score: number;                       // 0..1
  reason: string;
};
