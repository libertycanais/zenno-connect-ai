// FEATURE — Marketing Intelligence Experience · Tests (additive)
import { describe, it, expect, beforeEach } from "vitest";
import {
  runMarketingIntelligencePipeline,
  clearPipelineCache,
  clearMarketingContext,
  clearTimeline,
  clearRuns,
  clearSnapshots,
  clearMarketingListeners,
  getSnapshot,
  listSnapshotHistory,
  computeIntelligenceScore,
  buildProactiveBriefing,
  onMarketingEvent,
  orchestrateAfterSync,
  notifyPlatformConnected,
  computeMarketingHealth,
  computeAIReadiness,
  type CampaignFacts,
  type TrackingFacts,
  type MarketingEvent,
} from "@/lib/marketing/intelligence";

const camps: CampaignFacts[] = [
  { id: "c1", name: "Winner", status: "enabled", spendCents: 100_000, conversions: 40, clicks: 800, impressions: 40_000, revenueCents: 500_000, roas: 5, ctr: 0.02 },
  { id: "c2", name: "Waste", status: "enabled", spendCents: 200_000, conversions: 0, clicks: 300, impressions: 60_000, revenueCents: 0, roas: 0, ctr: 0.005 },
];
const tracking: TrackingFacts = {
  coverage: 0.9, conversionsConfigured: true, offlineConversions: false,
  ga4Linked: true, gscLinked: true, gtmPresent: true,
};

beforeEach(() => {
  clearPipelineCache();
  clearMarketingContext();
  clearTimeline();
  clearRuns();
  clearSnapshots();
  clearMarketingListeners();
});

describe("Marketing Intelligence Experience — Score", () => {
  it("computes an executive score 0..100 with grade", () => {
    const health = computeMarketingHealth(camps, tracking);
    const readiness = computeAIReadiness(camps, tracking);
    const score = computeIntelligenceScore({ health, readiness, recommendations: [] });
    expect(score.score).toBeGreaterThanOrEqual(0);
    expect(score.score).toBeLessThanOrEqual(100);
    expect(["Enterprise", "Advanced", "Growing", "Foundational"]).toContain(score.grade);
  });
});

describe("Marketing Intelligence Experience — Snapshot + Events", () => {
  it("orchestrateAfterSync emits events and updates snapshot", async () => {
    const seen: string[] = [];
    onMarketingEvent("MarketingSyncStarted", () => { seen.push("start"); });
    onMarketingEvent("MarketingSyncCompleted", () => { seen.push("done"); });
    onMarketingEvent("MarketingIntelligenceSnapshotUpdated", (e: MarketingEvent<"MarketingIntelligenceSnapshotUpdated">) => {
      seen.push(`snap:${e.score}`);
    });

    await orchestrateAfterSync({
      organizationId: "org-1", provider: "google", connectionId: "conn-1",
      campaigns: camps, tracking,
    });

    expect(seen).toContain("start");
    expect(seen).toContain("done");
    expect(seen.some((s) => s.startsWith("snap:"))).toBe(true);

    const snap = getSnapshot("org-1");
    expect(snap).not.toBeNull();
    expect(snap!.score.score).toBeGreaterThan(0);
    expect(listSnapshotHistory("org-1").length).toBeGreaterThan(0);
  });

  it("notifyPlatformConnected emits MarketingPlatformConnected", () => {
    let got = false;
    onMarketingEvent("MarketingPlatformConnected", () => { got = true; });
    notifyPlatformConnected({ organizationId: "org-2", provider: "google", connectionId: "c-2" });
    expect(got).toBe(true);
  });
});

describe("Marketing Intelligence Experience — Proactive Briefing", () => {
  it("returns onboarding briefing when no snapshot exists", () => {
    const b = buildProactiveBriefing(null);
    expect(b.headline).toMatch(/dia|tarde|noite/i);
    expect(b.cta).toBe("Conectar Google");
  });

  it("summarizes opportunities/risks when snapshot exists", () => {
    runMarketingIntelligencePipeline({
      organizationId: "org-3", provider: "google", connectionId: "conn-3",
      campaigns: camps, tracking,
    });
    const snap = getSnapshot("org-3");
    const b = buildProactiveBriefing(snap);
    expect(b.body.length).toBeGreaterThan(0);
    expect(b.headline).toMatch(/dia|tarde|noite/i);
  });
});