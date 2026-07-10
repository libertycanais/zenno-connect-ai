// EPIC J — Filters · pure predicates and composers for feed/rec/action lists
import type { FeedFilter, InsightItem, ProductAction, ProductDomain, ProductRecommendation, ProductSeverity } from "../types";

export const filters = {
  byDomain<T extends { domain: ProductDomain }>(domain: ProductDomain) {
    return (x: T): boolean => x.domain === domain;
  },
  bySeverity<T extends { severity: ProductSeverity }>(sev: ProductSeverity) {
    return (x: T): boolean => x.severity === sev;
  },
  bySearch<T extends { title: string; summary?: string; description?: string }>(q: string) {
    const lower = q.toLowerCase();
    return (x: T): boolean => `${x.title} ${x.summary ?? ""} ${x.description ?? ""}`.toLowerCase().includes(lower);
  },
  compose<T>(...preds: Array<(x: T) => boolean>) {
    return (x: T): boolean => preds.every((p) => p(x));
  },
};

export function applyFeedFilter(items: InsightItem[], f: FeedFilter): InsightItem[] {
  return items.filter((i) => {
    if (f.domains?.length && !f.domains.includes(i.domain)) return false;
    if (f.severities?.length && !f.severities.includes(i.severity)) return false;
    if (f.kinds?.length && !f.kinds.includes(i.kind)) return false;
    if (f.since && i.occurredAt < f.since) return false;
    if (f.until && i.occurredAt > f.until) return false;
    if (f.search && !`${i.title} ${i.summary}`.toLowerCase().includes(f.search.toLowerCase())) return false;
    return true;
  });
}

export function filterRecommendations(items: ProductRecommendation[], opts: { domain?: ProductDomain; minConfidence?: number }): ProductRecommendation[] {
  return items.filter((r) => {
    if (opts.domain && r.domain !== opts.domain) return false;
    if (typeof opts.minConfidence === "number" && r.confidence < opts.minConfidence) return false;
    return true;
  });
}

export function filterActions(items: ProductAction[], opts: { domain?: ProductDomain; minConfidence?: number }): ProductAction[] {
  return items.filter((a) => {
    if (opts.domain && a.domain !== opts.domain) return false;
    if (typeof opts.minConfidence === "number" && a.confidence < opts.minConfidence) return false;
    return true;
  });
}
