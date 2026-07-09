// Expert Architecture — Shared contracts (Experts substituem Analyzers, com alias)
import type { KnowledgeDomain, KnowledgeRule } from "../knowledge/types";
import type { EvidenceBundle } from "../evidence";
import type { Playbook } from "../playbooks";
import type { Recommendation } from "../recommendation";
import type { KpiResult } from "@/lib/business/types";

export type ExpertId = "marketing" | "sales" | "finance" | "executive" | "seo" | "growth" | "cro" | "crm";

export type ExpertConfidenceRule = {
  minSources: number;
  minKpis: number;
  minConfidence: number;
};

export type ExpertPromptTemplate = {
  templateId: string;
  version: string;
  systemPrompt: string;
  userPromptFingerprint: string;   // hashable
};

export type ExpertDescriptor = {
  id: ExpertId;
  displayName: string;
  domains: KnowledgeDomain[];
  skills: string[];
  capabilities: Array<"insight" | "diagnostic" | "recommendation" | "forecast" | "benchmark">;
  businessRules: string[];         // ids in the KnowledgeRegistry
  promptTemplates: ExpertPromptTemplate[];
  confidenceRules: ExpertConfidenceRule;
  active: boolean;
};

export type ExpertRunInput = {
  organizationId: string;
  focus: string;                   // untrusted human intent
  kpis: KpiResult[];
  triggeredRules: KnowledgeRule[];
};

export type ExpertRunOutput = {
  expertId: ExpertId;
  evidence: EvidenceBundle;
  recommendations: Recommendation[];
  playbooks: Playbook[];
  generatedAt: string;
};

/** Alias mantido para compatibilidade com "Analyzer" — Experts é a nomenclatura oficial. */
export type Analyzer = Expert;
export interface Expert {
  readonly descriptor: ExpertDescriptor;
  run(input: ExpertRunInput): ExpertRunOutput;
}
