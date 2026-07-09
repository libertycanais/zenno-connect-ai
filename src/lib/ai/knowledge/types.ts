// Knowledge Layer · Shared types (typed, no free text prompts)
export type KnowledgeDomain =
  | "google-ads" | "meta-ads" | "seo" | "cro" | "crm"
  | "tracking" | "analytics" | "finance" | "growth" | "executive"
  | "benchmarks" | "lgpd" | "meta-policies" | "google-policies" | "best-practices";

export type KnowledgeSeverity = "info" | "warn" | "critical";

export type KnowledgeRule = {
  id: string;                          // canonical, stable
  domain: KnowledgeDomain;
  title: string;
  description: string;
  when: string[];                      // triggers (e.g. "ctr < benchmark.p25")
  recommend: string[];                 // actions (stable ids or short imperatives)
  severity: KnowledgeSeverity;
  references: string[];                // external URLs or internal doc ids
  version: string;                     // semver
};

export type KnowledgeModule = {
  domain: KnowledgeDomain;
  version: string;
  rules: readonly KnowledgeRule[];
};
