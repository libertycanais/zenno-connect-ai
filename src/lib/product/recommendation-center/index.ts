// EPIC J — RecommendationCenter · read-model grouping by domain
import type { OrgScoped, ProductDomain, ProductRecommendation } from "../types";

export class RecommendationCenter {
  private byOrg = new Map<string, ProductRecommendation[]>();

  ingest(rec: ProductRecommendation): void {
    const list = this.byOrg.get(rec.organizationId) ?? [];
    list.unshift(rec);
    this.byOrg.set(rec.organizationId, list);
  }

  ingestMany(recs: ProductRecommendation[]): void { for (const r of recs) this.ingest(r); }

  list(o: OrgScoped, filter?: { domain?: ProductDomain; minConfidence?: number }): ProductRecommendation[] {
    const list = this.byOrg.get(o.organizationId) ?? [];
    return list.filter((r) => {
      if (filter?.domain && r.domain !== filter.domain) return false;
      if (typeof filter?.minConfidence === "number" && r.confidence < filter.minConfidence) return false;
      return true;
    });
  }

  groupByDomain(o: OrgScoped): Record<ProductDomain, ProductRecommendation[]> {
    const out: Record<string, ProductRecommendation[]> = {};
    for (const r of this.list(o)) {
      (out[r.domain] ??= []).push(r);
    }
    return out as Record<ProductDomain, ProductRecommendation[]>;
  }

  topN(o: OrgScoped, n: number): ProductRecommendation[] {
    return this.list(o)
      .slice()
      .sort((a, b) => b.impactCents * b.confidence - a.impactCents * a.confidence)
      .slice(0, n);
  }
}
