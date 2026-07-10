import { describe, it, expect, vi } from "vitest";
import { MonitoringEngine, SignalDeduplicator, SignalCooldown, SignalDispatcher, SignalHistory, mergeSignals } from "@/lib/ai/monitoring";
import type { BusinessSignal } from "@/lib/ai/signals";

function fakeSignal(overrides: Partial<BusinessSignal> = {}): BusinessSignal {
  return {
    id: "sig_1", organizationId: "org-1", type: "ROASDrop", domain: "marketing",
    severity: "high", score: 80, priority: 2, confidence: 0.8,
    createdAt: new Date().toISOString(),
    source: { origin: "kpi", ref: "roas" },
    evidence: [], recommendedExperts: ["marketing"], status: "open",
    dedupeKey: "dedupe-1", ...overrides,
  };
}

describe("EPIC G · Deduplicator + Cooldown", () => {
  it("suppresses duplicates within window", () => {
    const d = new SignalDeduplicator(60_000);
    expect(d.shouldEmit(fakeSignal(), 0)).toBe(true);
    expect(d.shouldEmit(fakeSignal(), 30_000)).toBe(false);
    expect(d.shouldEmit(fakeSignal(), 61_000)).toBe(true);
  });

  it("applies cooldown per type per org", () => {
    const c = new SignalCooldown(60_000);
    c.mark("org-1", "ROASDrop", 0);
    expect(c.isCooling("org-1", "ROASDrop", 30_000)).toBe(true);
    expect(c.isCooling("org-1", "ROASDrop", 61_000)).toBe(false);
    expect(c.isCooling("org-2", "ROASDrop", 30_000)).toBe(false);
  });
});

describe("EPIC G · Dispatcher", () => {
  it("delivers to registered experts and skips missing ones", async () => {
    const dispatcher = new SignalDispatcher();
    const handler = vi.fn();
    dispatcher.register("marketing", handler);
    const result = await dispatcher.dispatch(fakeSignal({ recommendedExperts: ["marketing", "finance"] }));
    expect(handler).toHaveBeenCalledOnce();
    expect(result.delivered).toEqual(["marketing"]);
    expect(result.skipped).toEqual(["finance"]);
  });
});

describe("EPIC G · MonitoringEngine tick", () => {
  it("runs registered jobs, dispatches and records history", async () => {
    const engine = new MonitoringEngine();
    engine.scheduler.register({
      id: "job1", organizationId: "org-1", cadence: "daily", enabled: true,
      loader: () => ({
        organizationId: "org-1",
        kpis:     { roas: 0.5, ctr: 0.005, cpa: 8000 },
        baseline: { roas: 2.0, ctr: 0.02,  cpa: 3000 },
      }),
    });
    const handler = vi.fn();
    engine.dispatcher.register("marketing", handler);
    const { signals, runs } = await engine.tick("daily");
    expect(signals.length).toBeGreaterThan(0);
    expect(runs).toHaveLength(1);
    expect(handler).toHaveBeenCalled();
    expect(engine.history.list("org-1").length).toBe(signals.length);
  });
});

describe("EPIC G · Aggregator merge", () => {
  it("keeps the highest-score signal per dedupeKey", () => {
    const a = fakeSignal({ id: "a", score: 60, dedupeKey: "k" });
    const b = fakeSignal({ id: "b", score: 90, dedupeKey: "k" });
    const c = fakeSignal({ id: "c", score: 70, dedupeKey: "other" });
    const merged = mergeSignals([a], [b, c]);
    expect(merged.find(s => s.dedupeKey === "k")?.id).toBe("b");
    expect(merged.length).toBe(2);
  });
});

describe("EPIC G · SignalHistory", () => {
  it("caps history at max entries", () => {
    const h = new SignalHistory(3);
    for (let i = 0; i < 5; i++) h.push(fakeSignal({ id: `s${i}`, dedupeKey: `k${i}` }));
    expect(h.list("org-1").length).toBe(3);
  });
});
