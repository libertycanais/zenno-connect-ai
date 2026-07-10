// FEATURE — First Five Minutes · Tests (additive)
import { describe, it, expect, beforeEach } from "vitest";
import {
  runMarketingIntelligencePipeline,
  clearPipelineCache,
  clearMarketingContext,
  clearTimeline,
  clearRuns,
  clearSnapshots,
  clearMarketingListeners,
  clearTTFI,
  clearBriefings,
  orchestrateAfterSync,
  notifyPlatformConnected,
  getSnapshot,
  getPendingBriefing,
  getLastTTFI,
  buildOnboardingChecklist,
  computeAIConfidence,
  explainIntelligenceScore,
  computeIntelligenceScore,
  computeMarketingHealth,
  computeAIReadiness,
  formatTTFI,
  type CampaignFacts,
  type TrackingFacts,
} from "@/lib/marketing/intelligence";

const camps: CampaignFacts[] = Array.from({ length: 5 }, (_, i) => ({
  id: `c${i}`, name: `C${i}`, status: "enabled",
  spendCents: 100_000, conversions: 40, clicks: 800, impressions: 40_000,
  revenueCents: 500_000, roas: 5, ctr: 0.02,
}));
const tracking: TrackingFacts = {
  coverage: 0.9, conversionsConfigured: true, offlineConversions: false,
  ga4Linked: true, gscLinked: true, gtmPresent: true,
};

const org = "org_ffm";
const conn = "conn_ffm";

beforeEach(() => {
  clearPipelineCache(); clearMarketingContext(); clearTimeline();
  clearRuns(); clearSnapshots(); clearMarketingListeners();
  clearTTFI(); clearBriefings();
});

describe("First Five Minutes — AI Confidence", () => {
  it("scales with data density and returns rationale", () => {
    const empty = computeAIConfidence({});
    expect(empty.score).toBe(0);
    expect(empty.level).toBe("Low");

    const rich = computeAIConfidence({
      campaigns: Array.from({ length: 30 }, (_, i) => ({
        id: `x${i}`, name: "n", status: "enabled",
        spendCents: 0, conversions: 30, clicks: 0, impressions: 0, revenueCents: 0,
      })),
      historyMonths: 6,
      trackingCoverage: 1,
    });
    expect(rich.score).toBeGreaterThanOrEqual(90);
    expect(rich.level).toBe("Very High");
    expect(rich.rationale).toMatch(/campanha/);
  });
});

describe("First Five Minutes — Score Explainer", () => {
  it("produces headline + reasons", () => {
    const health = computeMarketingHealth(camps, tracking);
    const readiness = computeAIReadiness(camps, tracking);
    const score = computeIntelligenceScore({ health, readiness, recommendations: [] });
    const exp = explainIntelligenceScore(score, { risksCount: 0, opportunitiesCount: 0 });
    expect(exp.headline.length).toBeGreaterThan(0);
    expect(exp.detail).toMatch(/Nenhum problema/);
    expect(exp.reasons.length).toBe(3);
  });
});

describe("First Five Minutes — TTFI + Briefing + Snapshot enrichment", () => {
  it("measures TTFI, enqueues a briefing, enriches the snapshot", async () => {
    notifyPlatformConnected({ organizationId: org, provider: "google_ads", connectionId: conn });
    await orchestrateAfterSync({
      organizationId: org, provider: "google_ads", connectionId: conn,
      campaigns: camps, tracking,
    });

    const ttfi = getLastTTFI(org);
    expect(ttfi).not.toBeNull();
    expect(ttfi!.durationMs).not.toBeNull();
    expect(ttfi!.durationMs!).toBeGreaterThanOrEqual(0);

    const snap = getSnapshot(org);
    expect(snap).not.toBeNull();
    expect(snap!.confidence.score).toBeGreaterThan(0);
    expect(snap!.explanation.headline.length).toBeGreaterThan(0);

    const pending = getPendingBriefing(org);
    expect(pending).not.toBeNull();
    expect(pending!.status).toBe("pending");
  });

  it("formats TTFI durations for humans", () => {
    expect(formatTTFI(null)).toBe("—");
    expect(formatTTFI(430)).toMatch(/ms/);
    expect(formatTTFI(43_000)).toMatch(/s/);
    expect(formatTTFI(125_000)).toMatch(/m/);
  });
});

describe("First Five Minutes — Onboarding checklist", () => {
  it("reflects snapshot + ttfi state", async () => {
    notifyPlatformConnected({ organizationId: org, provider: "google_ads", connectionId: conn });
    await orchestrateAfterSync({
      organizationId: org, provider: "google_ads", connectionId: conn,
      campaigns: camps, tracking,
    });
    const list = buildOnboardingChecklist({
      platformConnected: true,
      snapshot: getSnapshot(org),
      ttfi: getLastTTFI(org),
      copilotReady: true,
    });
    expect(list.total).toBe(6);
    expect(list.completed).toBe(6);
    expect(list.ready).toBe(true);
  });
});
