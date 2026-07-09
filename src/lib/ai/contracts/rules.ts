// EPIC A — Zenno Brain · Business Rules contracts
import type { AIAgent } from "../types";
import type { PlanRequest } from "./planner";

export type RuleSeverity = "info" | "warn" | "error" | "block";
export type RuleOutcome = "allow" | "warn" | "block";

export type RuleContext = {
  organizationId: string;
  userId: string;
  agent: AIAgent;
  plan: string;                        // billing plan slug ("free", "starter", ...)
  role: string;                        // RBAC role
  featureFlags: string[];
  budgetRemainingCents: number;
  request: PlanRequest;
};

export type RuleEvaluation = {
  ruleKey: string;
  ruleVersion: string;
  ruleFingerprint: string;
  passed: boolean;
  outcome: RuleOutcome;
  severity: RuleSeverity;
  reason: string;                      // human-readable
  reasonCode: string;                  // machine-readable
  evaluatedAt: string;
};

export type BusinessRule = {
  key: string;
  version: string;
  fingerprint: string;
  severity: RuleSeverity;
  description: string;
  evaluate: (ctx: RuleContext) => RuleEvaluation | Promise<RuleEvaluation>;
};

export type RulesEngineReport = {
  organizationId: string;
  evaluations: RuleEvaluation[];
  outcome: RuleOutcome;                // aggregate (worst-of)
  blockingReasons: string[];
  evaluatedAt: string;
};
