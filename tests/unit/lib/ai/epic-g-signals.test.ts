import { describe, it, expect } from "vitest";
import { SignalEngine, signalRegistry, scoreToSeverity, computePriority } from "@/lib/ai/signals";
import { groupByDomain, topN } from "@/lib/ai/signals/aggregator";

describe("EPIC G · Signals — priority utils", () => {
  it("maps score to severity", () => {
    expect(scoreToSeverity(95)).toBe("critical");
    expect(scoreToSeverity(75)).toBe("high");
    expect(scoreToSeverity(50)).toBe("medium");
    expect(scoreToSeverity(25)).toBe("low");
    expect(scoreToSeverity(5)).toBe("info");
  });
  it("compresses priority with confidence + impact", () => {
    expect(computePriority("critical", 1, 1)).toBeGreaterThanOrEqual(1);
    expect(computePriority("info", 0, 0)).toBeLessThanOrEqual(5);
  });
});

describe("EPIC G · SignalEngine", () => {
  it("detects ROASDrop, CTRDrop, CPAIncrease from KPI inputs", () => {
    const engine = new SignalEngine(signalRegistry);
    const signals = engine.run({
      organizationId: "org-1",
      kpis:     { roas: 1.0, ctr: 0.008, cpa: 5000, conversionRate: 0.03 },
      baseline: { roas: 2.0, ctr: 0.02,  cpa: 3000, conversionRate: 0.03 },
    });
    const types = signals.map(s => s.type);
    expect(types).toContain("ROASDrop");
    expect(types).toContain("CTRDrop");
    expect(types).toContain("CPAIncrease");
    for (const s of signals) {
      expect(s.dedupeKey).toBeTruthy();
      expect(s.organizationId).toBe("org-1");
      expect(s.status).toBe("open");
    }
  });

  it("returns empty when no thresholds crossed", () => {
    const engine = new SignalEngine(signalRegistry);
    const signals = engine.run({
      organizationId: "org-1",
      kpis:     { roas: 2.0, ctr: 0.02, cpa: 3000 },
      baseline: { roas: 2.0, ctr: 0.02, cpa: 3000 },
    });
    expect(signals).toEqual([]);
  });

  it("aggregates by domain and returns top-N", () => {
    const engine = new SignalEngine(signalRegistry);
    const signals = engine.run({
      organizationId: "org-1",
      kpis:     { roas: 0.5, ctr: 0.005, cpa: 8000, leads: 40, mrr: 900, churn: 0.3 },
      baseline: { roas: 2.0, ctr: 0.02,  cpa: 3000, leads: 100, mrr: 1000, churn: 0.1 },
    });
    const domains = groupByDomain(signals);
    expect(domains.marketing?.length).toBeGreaterThan(0);
    expect(topN(signals, 3).length).toBeLessThanOrEqual(3);
  });
});
