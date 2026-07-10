// EPIC J — ExecutiveWorkspace · aggregates Executive assets into a single view-model
import type { ExecutiveReport } from "@/lib/ai/executive/types";
import type { InsightItem, OrgScoped, ProductRecommendation } from "../types";
import type { InsightFeed } from "../insight-feed";
import type { RecommendationCenter } from "../recommendation-center";

export type ExecutiveHomeView = OrgScoped & {
  brief: string | null;
  score: number | null;
  topRecommendations: ProductRecommendation[];
  latestInsights: InsightItem[];
  latestReportId: string | null;
  generatedAt: string;
};

export type ExecutiveTimelineEntry = {
  at: string;
  kind: "report" | "insight" | "recommendation";
  refId: string;
  title: string;
};

export class ExecutiveWorkspace {
  private reportsByOrg = new Map<string, ExecutiveReport[]>();

  constructor(
    private recs: RecommendationCenter,
    private feed: InsightFeed,
  ) {}

  publishReport(r: ExecutiveReport): void {
    const list = this.reportsByOrg.get(r.organizationId) ?? [];
    list.unshift(r);
    this.reportsByOrg.set(r.organizationId, list);
  }

  latestReport(o: OrgScoped): ExecutiveReport | null {
    return (this.reportsByOrg.get(o.organizationId) ?? [])[0] ?? null;
  }

  reports(o: OrgScoped): ExecutiveReport[] {
    return (this.reportsByOrg.get(o.organizationId) ?? []).slice();
  }

  home(o: OrgScoped): ExecutiveHomeView {
    const last = this.latestReport(o);
    return {
      organizationId: o.organizationId,
      brief: last?.narrative ?? null,
      score: last?.score.overall ?? null,
      topRecommendations: this.recs.topN(o, 5),
      latestInsights: this.feed.latest(o, 10),
      latestReportId: last?.reportId ?? null,
      generatedAt: new Date().toISOString(),
    };
  }

  timeline(o: OrgScoped, limit = 25): ExecutiveTimelineEntry[] {
    const out: ExecutiveTimelineEntry[] = [];
    for (const r of this.reports(o)) out.push({ at: r.generatedAt, kind: "report", refId: r.reportId, title: r.summary });
    for (const i of this.feed.list(o)) out.push({ at: i.occurredAt, kind: "insight", refId: i.id, title: i.title });
    for (const r of this.recs.list(o)) out.push({ at: r.createdAt, kind: "recommendation", refId: r.id, title: r.title });
    return out.sort((a, b) => b.at.localeCompare(a.at)).slice(0, limit);
  }
}
