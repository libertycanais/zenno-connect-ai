import { describe, it, expect, beforeEach } from "vitest";
import {
  runMarketingIntelligencePipeline,
  computeMarketingHealth,
  computeAIReadiness,
  buildRecommendations,
  buildExecutiveSummary,
  getMarketingContext,
  clearMarketingContext,
  listTimeline,
  clearTimeline,
  clearPipelineCache,
  getRuns,
  clearRuns,
  type CampaignFacts,
  type TrackingFacts,
} from "@/lib/marketing/intelligence";

const camps: CampaignFacts[] = [
  { id: "c1", name: "Winner", status: "enabled", spendCents: 100_000, conversions: 40, clicks: 800, impressions: 40_000, revenueCents: 500_000, roas: 5, ctr: 0.02 },
  { id: "c2", name: "Waste", status: "enabled", spendCents: 200_000, conversions: 0, clicks: 300, impressions: 60_000, revenueCents: 0, roas: 0, ctr: 0.005 },
];

const tracking: TrackingFacts = {
  coverage: 0.9, conversionsConfigured: true, offlineConversions: false,
  ga4Linked: true, gscLinked: true, gtmPresent: true,
};

describe("Marketing Intelligence — health & readiness", () => {
  it("compute health across 5 dimensions", () => {
    const h = computeMarketingHealth(camps, tracking);
    expect(h.components).toHaveLength(5);
    expect(h.overall).toBeGreaterThanOrEqual(0);
    expect(h.overall).toBeLessThanOrEqual(100);
  });
  it("AI readiness reports gaps", () => {
    const r = computeAIReadiness(camps, { ...tracking, ga4Linked: false });
    const analytics = r.components.find((c) => c.key === "analytics")!;
    expect(analytics.ready).toBe(false);
    expect(analytics.gap).toBeTruthy();
  });
  it("empty inputs classify as critical", () => {
    const h = computeMarketingHealth([], undefined);
    expect(h.severity).toBe("critical");
  });
});

describe("Marketing Intelligence — recommendations & executive", () => {
  it("flags wasted spend and scaling opportunities", () => {
    const health = computeMarketingHealth(camps, tracking);
    const recs = buildRecommendations({
      organizationId: "org1", provider: "google", campaigns: camps, tracking, health,
    });
    expect(recs.some((r) => /desperdício|Desperdício/.test(r.impact))).toBe(true);
    expect(recs.some((r) => r.priority === "high" || r.priority === "critical")).toBe(true);
  });
  it("executive summary aggregates and picks priority", () => {
    const health = computeMarketingHealth(camps, tracking);
    const recs = buildRecommendations({ organizationId: "org1", provider: "google", campaigns: camps, tracking, health });
    const exec = buildExecutiveSummary({ organizationId: "org1", provider: "google", health, recommendations: recs });
    expect(exec.nextSteps.length).toBeGreaterThan(0);
    expect(exec.estimatedRoiCents).toBeGreaterThanOrEqual(0);
    expect(exec.sources.length).toBeGreaterThan(0);
  });
});

describe("Marketing Intelligence — pipeline orchestration", () => {
  beforeEach(() => {
    clearMarketingContext();
    clearTimeline();
    clearPipelineCache();
    clearRuns();
  });
  it("runs end-to-end, updates context, timeline and metrics", () => {
    const res = runMarketingIntelligencePipeline({
      organizationId: "orgX", provider: "google", connectionId: "conn1",
      campaigns: camps, tracking,
    });
    expect(res.recommendations.length).toBeGreaterThan(0);
    expect(res.executive.healthScore).toBe(res.health.overall);
    const ctx = getMarketingContext("orgX");
    expect(ctx?.connectedProviders).toContain("google");
    const tl = listTimeline("orgX");
    expect(tl.length).toBeGreaterThan(0);
    expect(getRuns("orgX").length).toBe(1);
  });
  it("multi-tenant isolation — orgs do not see each other", () => {
    runMarketingIntelligencePipeline({ organizationId: "orgA", provider: "google", connectionId: "cA", campaigns: camps, tracking });
    runMarketingIntelligencePipeline({ organizationId: "orgB", provider: "google", connectionId: "cB", campaigns: camps, tracking });
    expect(listTimeline("orgA").every((r) => r.organizationId === "orgA")).toBe(true);
    expect(listTimeline("orgB").every((r) => r.organizationId === "orgB")).toBe(true);
  });
  it("caches result within TTL to avoid re-analysis", () => {
    const a = runMarketingIntelligencePipeline({ organizationId: "orgC", provider: "google", connectionId: "cC", campaigns: camps, tracking });
    const b = runMarketingIntelligencePipeline({ organizationId: "orgC", provider: "google", connectionId: "cC", campaigns: camps, tracking });
    expect(b).toBe(a);
  });
});
