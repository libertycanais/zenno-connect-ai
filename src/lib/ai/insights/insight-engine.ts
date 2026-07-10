import type { BusinessSignal } from "../signals/types";
import type { Insight, InsightRule } from "./types";
import { builtInInsightRules } from "./rules";

export class InsightEngine {
  constructor(private readonly rules: InsightRule[] = builtInInsightRules) {}

  register(rule: InsightRule): void { this.rules.push(rule); }

  build(signals: BusinessSignal[]): Insight[] {
    const out: Insight[] = [];
    for (const rule of this.rules) {
      if (!rule.matches(signals)) continue;
      const partial = rule.build(signals);
      out.push({
        ...partial,
        id: `insight_${rule.id}_${Date.now()}`,
        createdAt: new Date().toISOString(),
      });
    }
    return out;
  }
}

export const insightEngine = new InsightEngine();
