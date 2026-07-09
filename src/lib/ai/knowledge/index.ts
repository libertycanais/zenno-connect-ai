// Knowledge Layer · Facade + Registry
import type { KnowledgeDomain, KnowledgeModule, KnowledgeRule } from "./types";
import { metaAdsKnowledge } from "./meta-ads";
import { googleAdsKnowledge } from "./google-ads";
import { trackingKnowledge } from "./tracking";
import { seoKnowledge } from "./seo";
import { croKnowledge } from "./cro";
import { crmKnowledge } from "./crm";
import { analyticsKnowledge } from "./analytics";
import { financeKnowledge } from "./finance";
import { growthKnowledge } from "./growth";
import { executiveKnowledge } from "./executive";
import { benchmarksKnowledge } from "./benchmarks";
import { lgpdKnowledge } from "./lgpd";
import { metaPoliciesKnowledge } from "./meta-policies";
import { googlePoliciesKnowledge } from "./google-policies";
import { bestPracticesKnowledge } from "./best-practices";

export * from "./types";
export {
  metaAdsKnowledge, googleAdsKnowledge, trackingKnowledge, seoKnowledge,
  croKnowledge, crmKnowledge, analyticsKnowledge, financeKnowledge,
  growthKnowledge, executiveKnowledge, benchmarksKnowledge, lgpdKnowledge,
  metaPoliciesKnowledge, googlePoliciesKnowledge, bestPracticesKnowledge,
};

const ALL: readonly KnowledgeModule[] = [
  metaAdsKnowledge, googleAdsKnowledge, trackingKnowledge, seoKnowledge,
  croKnowledge, crmKnowledge, analyticsKnowledge, financeKnowledge,
  growthKnowledge, executiveKnowledge, benchmarksKnowledge, lgpdKnowledge,
  metaPoliciesKnowledge, googlePoliciesKnowledge, bestPracticesKnowledge,
];

export class KnowledgeRegistry {
  private byDomain = new Map<KnowledgeDomain, KnowledgeModule>();
  constructor(mods: readonly KnowledgeModule[] = ALL) {
    for (const m of mods) this.byDomain.set(m.domain, m);
  }
  get(domain: KnowledgeDomain): KnowledgeModule | undefined { return this.byDomain.get(domain); }
  list(): KnowledgeModule[] { return [...this.byDomain.values()]; }
  rules(domain: KnowledgeDomain): readonly KnowledgeRule[] { return this.byDomain.get(domain)?.rules ?? []; }
  findRule(id: string): KnowledgeRule | undefined {
    for (const m of this.byDomain.values()) {
      const r = m.rules.find((x) => x.id === id);
      if (r) return r;
    }
    return undefined;
  }
}

export const knowledge = new KnowledgeRegistry();
