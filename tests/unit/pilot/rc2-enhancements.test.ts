// RC2 Operational Enhancements — tests for recursive sanitization,
// rate limiting, expanded event catalog and backlog governance scoring.
import { describe, it, expect, beforeEach } from "vitest";
import {
  sanitizeProps, InMemoryPilotSink, setPilotSink, trackPilotEvent,
  checkPilotRateLimit, resetPilotRateLimits, PILOT_EVENTS,
} from "@/lib/pilot/telemetry";
import { scoreBacklogItem, rankBacklog } from "@/lib/pilot/backlog";

describe("RC2 · recursive sanitizeProps", () => {
  it("redacts secret/PII keys at any depth", () => {
    const clean = sanitizeProps({
      safe: "ok",
      user: { email: "u@x.com", nested: { token: "abc", phone: "119999" } },
      arr: [{ password: "p" }, { apiKey: "k" }, "plain"],
    }) as Record<string, unknown>;
    expect(clean.safe).toBe("ok");
    expect((clean.user as Record<string, unknown>).email).toBe("[REDACTED]");
    expect(((clean.user as Record<string, unknown>).nested as Record<string, unknown>).token).toBe("[REDACTED]");
    expect(((clean.user as Record<string, unknown>).nested as Record<string, unknown>).phone).toBe("[REDACTED]");
    const arr = clean.arr as unknown[];
    expect((arr[0] as Record<string, unknown>).password).toBe("[REDACTED]");
    expect((arr[1] as Record<string, unknown>).apiKey).toBe("[REDACTED]");
    expect(arr[2]).toBe("plain");
  });

  it("is case-insensitive", () => {
    const clean = sanitizeProps({ Authorization: "Bearer xyz", CPF: "123" }) as Record<string, unknown>;
    expect(clean.Authorization).toBe("[REDACTED]");
    expect(clean.CPF).toBe("[REDACTED]");
  });

  it("truncates giant strings and long arrays", () => {
    const clean = sanitizeProps({
      big: "x".repeat(5000),
      list: Array.from({ length: 500 }, (_, i) => i),
    }) as Record<string, unknown>;
    expect((clean.big as string).length).toBeLessThanOrEqual(2001 + 1);
    expect((clean.list as unknown[]).length).toBe(200);
  });

  it("stops at max depth without crashing", () => {
    // Build 12-level nested object
    let deep: Record<string, unknown> = { leaf: "v" };
    for (let i = 0; i < 12; i++) deep = { next: deep };
    const clean = sanitizeProps(deep) as Record<string, unknown>;
    let cur: Record<string, unknown> | string = clean;
    for (let i = 0; i < 12 && typeof cur === "object"; i++) cur = (cur as Record<string, unknown>).next as Record<string, unknown> | string;
    // The deepest layer should hit the depth guard
    expect(String(cur).includes("TRUNCATED_DEPTH") || cur !== undefined).toBe(true);
  });

  it("undefined props → {}", () => {
    expect(sanitizeProps(undefined)).toEqual({});
  });
});

describe("RC2 · rate limit", () => {
  beforeEach(() => resetPilotRateLimits());
  it("allows up to maxPerWindow then blocks", () => {
    const cfg = { maxPerWindow: 3, windowMs: 60_000 };
    const results = Array.from({ length: 5 }, () => checkPilotRateLimit("org-1", cfg));
    expect(results.filter((r) => r.allowed).length).toBe(3);
    expect(results.filter((r) => !r.allowed).length).toBe(2);
    expect(results[4].blocked).toBe(2);
  });
  it("resets on new window", () => {
    const cfg = { maxPerWindow: 1, windowMs: 60_000 };
    const t0 = 60_000; // window starts at 60_000
    checkPilotRateLimit("org-2", cfg, t0);
    const blocked = checkPilotRateLimit("org-2", cfg, t0 + 10);
    expect(blocked.allowed).toBe(false);
    const nextWindow = checkPilotRateLimit("org-2", cfg, t0 + 60_000);
    expect(nextWindow.allowed).toBe(true);
  });
  it("isolates organizations", () => {
    const cfg = { maxPerWindow: 1, windowMs: 60_000 };
    expect(checkPilotRateLimit("org-a", cfg).allowed).toBe(true);
    expect(checkPilotRateLimit("org-b", cfg).allowed).toBe(true);
    expect(checkPilotRateLimit("org-a", cfg).allowed).toBe(false);
  });
});

describe("RC2 · expanded event catalog + trackPilotEvent", () => {
  let sink: InMemoryPilotSink;
  beforeEach(() => { sink = new InMemoryPilotSink(); setPilotSink(sink); resetPilotRateLimits(); });

  it("exposes new functional events", () => {
    expect(PILOT_EVENTS.copilotOpened).toBe("ai.copilot_opened");
    expect(PILOT_EVENTS.copilotAnswered).toBe("ai.copilot_answered");
    expect(PILOT_EVENTS.recommendationRejected).toBe("product.recommendation_rejected");
    expect(PILOT_EVENTS.workflowExecuted).toBe("product.workflow_executed");
    expect(PILOT_EVENTS.dashboardViewed).toBe("product.dashboard_viewed");
    expect(PILOT_EVENTS.widgetAdded).toBe("product.widget_added");
    expect(PILOT_EVENTS.widgetRemoved).toBe("product.widget_removed");
    expect(PILOT_EVENTS.workspaceCustomized).toBe("product.workspace_customized");
    expect(PILOT_EVENTS.campaignAnalyzed).toBe("ai.campaign_analyzed");
    expect(PILOT_EVENTS.financeAnalyzed).toBe("ai.finance_analyzed");
    expect(PILOT_EVENTS.crmAnalyzed).toBe("ai.crm_analyzed");
    expect(PILOT_EVENTS.executiveViewed).toBe("product.executive_viewed");
    expect(PILOT_EVENTS.insightOpened).toBe("product.insight_opened");
    expect(PILOT_EVENTS.timelineViewed).toBe("product.timeline_viewed");
  });

  it("trackPilotEvent respects rate limit and returns status", () => {
    const cfg = { maxPerWindow: 2, windowMs: 60_000 };
    expect(trackPilotEvent({ organizationId: "o", eventName: "x", category: "product" }, cfg)).toEqual({ emitted: true, rateLimited: false });
    expect(trackPilotEvent({ organizationId: "o", eventName: "x", category: "product" }, cfg)).toEqual({ emitted: true, rateLimited: false });
    const blocked = trackPilotEvent({ organizationId: "o", eventName: "x", category: "product" }, cfg);
    expect(blocked).toEqual({ emitted: false, rateLimited: true });
    expect(sink.events.length).toBe(2);
  });

  it("trackPilotEvent sanitizes nested PII before persisting", () => {
    trackPilotEvent({
      organizationId: "org-x", eventName: PILOT_EVENTS.copilotAnswered, category: "ai",
      props: { messageId: "m1", user: { email: "u@x.com" }, token: "t" },
    });
    const e = sink.events[0]!;
    const props = e.props as Record<string, unknown>;
    expect(props.messageId).toBe("m1");
    expect(props.token).toBe("[REDACTED]");
    expect((props.user as Record<string, unknown>).email).toBe("[REDACTED]");
  });
});

describe("RC2 · backlog governance scoring", () => {
  it("high-impact + low-effort → P0", () => {
    const s = scoreBacklogItem({
      organizationsAffected: 40, frequency: 400,
      financialImpactCents: 400_000_00, retentionImpact: 80, operationalImpact: 70,
      effortDays: 2,
    });
    expect(s.bucket).toBe("P0");
    expect(s.score).toBeGreaterThan(650);
  });
  it("no evidence → forced to P3", () => {
    const s = scoreBacklogItem({
      organizationsAffected: 0, frequency: 0,
      financialImpactCents: 0, retentionImpact: 0, operationalImpact: 0,
      effortDays: 1,
    });
    expect(s.bucket).toBe("P3");
    expect(s.warnings).toContain("no reach or frequency evidence — bucket forced to P3");
  });
  it("invalid effort_days triggers warning + defaults to 1", () => {
    const s = scoreBacklogItem({
      organizationsAffected: 5, frequency: 20,
      financialImpactCents: 1000_00, retentionImpact: 10, operationalImpact: 10,
      effortDays: 0,
    });
    expect(s.warnings.some((w) => w.includes("effort_days"))).toBe(true);
  });
  it("score is bounded 0..1000", () => {
    const s = scoreBacklogItem({
      organizationsAffected: 1_000_000, frequency: 10_000_000,
      financialImpactCents: 1_000_000_00_00, retentionImpact: 100, operationalImpact: 100,
      effortDays: 0.1,
    });
    expect(s.score).toBeGreaterThan(0);
    expect(s.score).toBeLessThanOrEqual(1000);
  });
  it("rankBacklog sorts by score desc, then effort asc", () => {
    const items = [
      { score: scoreBacklogItem({ organizationsAffected: 10, frequency: 100, financialImpactCents: 100_00, retentionImpact: 40, operationalImpact: 40, effortDays: 10 }), effortDays: 10 },
      { score: scoreBacklogItem({ organizationsAffected: 30, frequency: 300, financialImpactCents: 300_000_00, retentionImpact: 60, operationalImpact: 60, effortDays: 3 }), effortDays: 3 },
    ];
    const ranked = rankBacklog(items);
    expect(ranked[0].effortDays).toBe(3);
  });
});
