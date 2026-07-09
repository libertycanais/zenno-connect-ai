// EPIC A — Zenno Brain · Feature Flag contracts
import type { AIAgent } from "../types";

export type FeatureFlagKey =
  | "enablePlanner"
  | "enableRecommendation"
  | "enableWorkflow"
  | "enableStreaming"
  | "enableConsensus"
  | "enableArtifacts"
  | "enableForecast"
  | "enableReasoning"
  | "enableClaudeAnalysis";

export type FeatureFlagContext = {
  environment: "development" | "staging" | "production";
  organizationId: string;
  userId: string;
  plan: string;                        // billing plan slug
  agent: AIAgent | null;
};

export type FeatureFlagRule = {
  key: FeatureFlagKey;
  enabled: boolean;
  environments?: FeatureFlagContext["environment"][];
  organizations?: string[];            // allow list
  plans?: string[];                    // allow list
  users?: string[];                    // allow list
  agents?: AIAgent[];                  // allow list
};

export type FeatureFlagSnapshot = {
  takenAt: string;
  context: FeatureFlagContext;
  active: FeatureFlagKey[];
  denied: Array<{ key: FeatureFlagKey; reason: string }>;
};
