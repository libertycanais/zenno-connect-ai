// EPIC B — AI Execution Platform · Domain Analyzer contracts (surface only)
// Contracts + extension points for Claude-first analytical domains. NO logic
// implemented here — analyzers plug into the ExecutionEngine via SkillRouter
// in a later Epic. Each domain declares required context, output schema
// version and policy tags.

import type { ContextModuleName } from "../context/types";

export type AnalyzerDomain =
  | "marketing"    // Meta / Google Ads
  | "sales"        // CRM
  | "finance"
  | "executive"
  | "seo"
  | "growth"
  | "tracking"
  | "cro"
  | "budget"
  | "forecast";

export type AnalyzerCapability =
  | "insight" | "recommendation" | "forecast" | "diagnostic" | "benchmark";

export type AnalyzerDescriptor = {
  domain: AnalyzerDomain;
  displayName: string;
  requiredContext: ContextModuleName[];
  capabilities: AnalyzerCapability[];
  outputSchemaVersion: string;         // semver
  suggestedSkills: string[];           // skill ids in the SkillRegistry
  suggestedProviders: string[];        // provider ids preferred
  policyTags: string[];                // e.g. ["pii-safe","read-only","budget-bound"]
  active: boolean;                     // wired in future Epic
};

export type AnalyzerRequest = {
  organizationId: string;
  userId: string;
  domain: AnalyzerDomain;
  focus: string;                       // human intent (untrusted; sanitized upstream)
  windowDays?: number;
};

export type AnalyzerOutput = {
  analyzerId: string;
  domain: AnalyzerDomain;
  outputSchemaVersion: string;
  insights: Array<{ title: string; detail: string; severity: "info" | "warn" | "risk" }>;
  recommendations: Array<{ title: string; rationale: string; priority: 1 | 2 | 3 }>;
  generatedAt: string;
};

/** Extension point — real analyzers registered in a future Epic. */
export interface DomainAnalyzer {
  readonly descriptor: AnalyzerDescriptor;
  // NOTE: run() is intentionally left unimplemented at this point — every
  //       analyzer must go through the ExecutionEngine facade, never call
  //       providers directly.
  run?(req: AnalyzerRequest): Promise<AnalyzerOutput>;
}
