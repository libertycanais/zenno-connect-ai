// EPIC J — Product Reports · deterministic exports (markdown/json)
import type { ExecutiveReport } from "@/lib/ai/executive/types";
import type { InsightItem, ProductAction, ProductRecommendation } from "../types";

export type ProductReportBundle = {
  organizationId: string;
  generatedAt: string;
  executive: ExecutiveReport | null;
  recommendations: ProductRecommendation[];
  actions: ProductAction[];
  insights: InsightItem[];
};

export function bundleToMarkdown(b: ProductReportBundle): string {
  const lines = [
    `# Product Report — ${b.organizationId}`,
    `_Generated: ${b.generatedAt}_`,
    ``,
    b.executive
      ? [
          `## Executive Score: ${b.executive.score.overall}/100`,
          ``,
          b.executive.narrative,
        ].join("\n")
      : `## Executive: (no report yet)`,
    ``,
    `## Recommendations (${b.recommendations.length})`,
    ...b.recommendations.slice(0, 20).map((r) => `- [${r.domain}] ${r.title} — impact=${r.impactCents}c conf=${r.confidence.toFixed(2)}`),
    ``,
    `## Actions (${b.actions.length})`,
    ...b.actions.slice(0, 20).map((a) => `- P${a.priority} · ${a.status} · ${a.title} (gain=${a.estimatedGainCents}c)`),
    ``,
    `## Insights (${b.insights.length})`,
    ...b.insights.slice(0, 20).map((i) => `- [${i.severity}] ${i.kind}: ${i.title}`),
  ];
  return lines.join("\n");
}

export function bundleToJson(b: ProductReportBundle): string {
  return JSON.stringify(b, null, 2);
}
