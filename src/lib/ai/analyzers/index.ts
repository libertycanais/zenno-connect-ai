// EPIC B — AI Execution Platform · Domain Analyzers (contracts + registry)
// Ten domain descriptors declared for Claude-first analytical workloads.
// No lógica — apenas registry + extensão. Analyzers rodam via ExecutionEngine.

import type { AnalyzerDescriptor, AnalyzerDomain, DomainAnalyzer } from "../contracts/analyzer";

export * from "../contracts/analyzer";

const DEFAULTS: AnalyzerDescriptor[] = [
  { domain: "marketing", displayName: "Marketing Analyzer",
    requiredContext: ["ads", "tracking"], capabilities: ["insight", "recommendation", "diagnostic"],
    outputSchemaVersion: "1.0.0", suggestedSkills: ["campaign_analysis"],
    suggestedProviders: ["anthropic"], policyTags: ["pii-safe", "read-only"], active: false },
  { domain: "sales", displayName: "Sales Analyzer",
    requiredContext: ["crm", "tracking"], capabilities: ["insight", "recommendation"],
    outputSchemaVersion: "1.0.0", suggestedSkills: ["crm_analysis"],
    suggestedProviders: ["anthropic"], policyTags: ["pii-safe", "read-only"], active: false },
  { domain: "finance", displayName: "Finance Analyzer",
    requiredContext: ["finance", "billing"], capabilities: ["insight", "forecast", "diagnostic"],
    outputSchemaVersion: "1.0.0", suggestedSkills: ["finance_analysis"],
    suggestedProviders: ["anthropic"], policyTags: ["read-only", "budget-bound"], active: false },
  { domain: "executive", displayName: "Executive Analyzer",
    requiredContext: ["executive", "billing", "ads"], capabilities: ["insight", "recommendation", "benchmark"],
    outputSchemaVersion: "1.0.0", suggestedSkills: ["executive_summary"],
    suggestedProviders: ["anthropic"], policyTags: ["read-only"], active: false },
  { domain: "seo", displayName: "SEO Analyzer",
    requiredContext: ["analytics"], capabilities: ["insight", "recommendation"],
    outputSchemaVersion: "1.0.0", suggestedSkills: ["seo_analysis"],
    suggestedProviders: ["anthropic"], policyTags: ["read-only"], active: false },
  { domain: "growth", displayName: "Growth Analyzer",
    requiredContext: ["tracking", "analytics", "ads"], capabilities: ["insight", "recommendation", "forecast"],
    outputSchemaVersion: "1.0.0", suggestedSkills: ["growth_analysis"],
    suggestedProviders: ["anthropic"], policyTags: ["read-only"], active: false },
  { domain: "tracking", displayName: "Tracking Analyzer",
    requiredContext: ["tracking", "analytics"], capabilities: ["diagnostic", "insight"],
    outputSchemaVersion: "1.0.0", suggestedSkills: ["tracking_analysis"],
    suggestedProviders: ["anthropic"], policyTags: ["read-only"], active: false },
  { domain: "cro", displayName: "CRO Analyzer",
    requiredContext: ["tracking", "analytics"], capabilities: ["diagnostic", "recommendation"],
    outputSchemaVersion: "1.0.0", suggestedSkills: ["cro_analysis"],
    suggestedProviders: ["anthropic"], policyTags: ["read-only"], active: false },
  { domain: "budget", displayName: "Budget Optimization Analyzer",
    requiredContext: ["ads", "billing"], capabilities: ["recommendation", "forecast"],
    outputSchemaVersion: "1.0.0", suggestedSkills: ["budget_optimization"],
    suggestedProviders: ["anthropic"], policyTags: ["read-only", "budget-bound"], active: false },
  { domain: "forecast", displayName: "Forecast Analyzer",
    requiredContext: ["billing", "tracking", "finance"], capabilities: ["forecast", "benchmark"],
    outputSchemaVersion: "1.0.0", suggestedSkills: ["forecast"],
    suggestedProviders: ["anthropic"], policyTags: ["read-only"], active: false },
];

export class AnalyzerRegistry {
  private byDomain = new Map<AnalyzerDomain, AnalyzerDescriptor>();
  private impls = new Map<AnalyzerDomain, DomainAnalyzer>();

  constructor(initial: AnalyzerDescriptor[] = DEFAULTS) {
    for (const d of initial) this.byDomain.set(d.domain, d);
  }
  list(): AnalyzerDescriptor[] { return [...this.byDomain.values()]; }
  get(domain: AnalyzerDomain): AnalyzerDescriptor | undefined { return this.byDomain.get(domain); }
  register(analyzer: DomainAnalyzer): void {
    this.byDomain.set(analyzer.descriptor.domain, analyzer.descriptor);
    this.impls.set(analyzer.descriptor.domain, analyzer);
  }
  impl(domain: AnalyzerDomain): DomainAnalyzer | undefined { return this.impls.get(domain); }
}

export const analyzers = new AnalyzerRegistry();
