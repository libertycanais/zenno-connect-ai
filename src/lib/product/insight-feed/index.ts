// EPIC J — InsightFeed · chronological, filterable
import type { FeedFilter, InsightItem, OrgScoped } from "../types";

export class InsightFeed {
  private byOrg = new Map<string, InsightItem[]>();

  publish(item: InsightItem): void {
    const list = this.byOrg.get(item.organizationId) ?? [];
    list.unshift(item);
    this.byOrg.set(item.organizationId, list);
  }

  list(o: OrgScoped, filter?: FeedFilter): InsightItem[] {
    let list = (this.byOrg.get(o.organizationId) ?? []).slice();
    if (filter) {
      const { domains, severities, kinds, since, until, search } = filter;
      list = list.filter((i) => {
        if (domains?.length && !domains.includes(i.domain)) return false;
        if (severities?.length && !severities.includes(i.severity)) return false;
        if (kinds?.length && !kinds.includes(i.kind)) return false;
        if (since && i.occurredAt < since) return false;
        if (until && i.occurredAt > until) return false;
        if (search && !`${i.title} ${i.summary}`.toLowerCase().includes(search.toLowerCase())) return false;
        return true;
      });
    }
    return list.sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
  }

  latest(o: OrgScoped, n: number): InsightItem[] { return this.list(o).slice(0, n); }
}
