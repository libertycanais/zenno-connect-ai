// RC2 Pilot Program — tests for additive pilot utilities
import { describe, it, expect, beforeEach } from "vitest";
import {
  InMemoryPilotSink, setPilotSink, trackPilotEvent, sanitizeProps, PILOT_EVENTS,
} from "@/lib/pilot/telemetry";
import {
  computeAdoptionScore, computeHealthScore, computeNps, computeCsat, computeTtfv,
} from "@/lib/pilot/scoring";
import { FeatureFlagRegistry, evaluateFlag, bucketOf } from "@/lib/pilot/feature-flags";
import { computeOnboardingProgress, nextRecommendedStep, ONBOARDING_STEPS } from "@/lib/pilot/onboarding";

describe("RC2 telemetry", () => {
  let sink: InMemoryPilotSink;
  beforeEach(() => { sink = new InMemoryPilotSink(); setPilotSink(sink); });

  it("records events with sanitized props", () => {
    trackPilotEvent({
      organizationId: "org-1", eventName: PILOT_EVENTS.featureUsed, category: "product",
      props: { widget: "score", password: "abc", token: "xyz", email: "u@x.com" },
    });
    expect(sink.count(PILOT_EVENTS.featureUsed)).toBe(1);
    const evt = sink.events[0];
    expect(evt.props?.widget).toBe("score");
    expect(evt.props?.password).toBe("[REDACTED]");
    expect(evt.props?.token).toBe("[REDACTED]");
    expect(evt.props?.email).toBe("[REDACTED]");
  });

  it("scopes by org & category", () => {
    trackPilotEvent({ organizationId: "org-1", eventName: "a", category: "product" });
    trackPilotEvent({ organizationId: "org-2", eventName: "b", category: "ai" });
    expect(sink.byOrg("org-1").length).toBe(1);
    expect(sink.byCategory("ai").length).toBe(1);
  });

  it("sanitizeProps truncates huge strings", () => {
    const p = sanitizeProps({ big: "x".repeat(5000) });
    expect(String(p.big).length).toBeLessThanOrEqual(2001 + 1);
  });
});

describe("RC2 scoring", () => {
  it("adoption score bounded 0..100", () => {
    const s = computeAdoptionScore({
      events: Array.from({ length: 100 }, () => ({ organizationId: "o", eventName: "x", category: "product" as const })),
      activeDays: 7, featuresUsed: new Set(["a","b","c"]), totalFeatures: 10,
    });
    expect(s).toBeGreaterThan(0); expect(s).toBeLessThanOrEqual(100);
  });

  it("health score high on stable + happy", () => {
    const s = computeHealthScore({
      errorRate: 0.001, crashRate: 0, p95LatencyMs: 200,
      npsAverage: 60, csatAverage: 4.6, activeDays: 12,
    });
    expect(s).toBeGreaterThan(80);
  });

  it("health score low on unstable", () => {
    const s = computeHealthScore({
      errorRate: 0.4, crashRate: 0.2, p95LatencyMs: 3000,
      npsAverage: -40, csatAverage: 1.5, activeDays: 1,
    });
    expect(s).toBeLessThan(40);
  });

  it("nps computes correctly", () => {
    expect(computeNps([])).toBeNull();
    expect(computeNps([10,10,9,9,6,3])).toBe(Math.round(((4-2)/6)*100*100)/100);
  });

  it("csat averages", () => {
    expect(computeCsat([])).toBeNull();
    expect(computeCsat([5,4,3])).toBe(4);
  });

  it("ttfv computes from event pair", () => {
    const t0 = new Date("2026-07-10T10:00:00Z").toISOString();
    const t1 = new Date("2026-07-10T10:05:30Z").toISOString();
    const s = computeTtfv([
      { organizationId: "o", eventName: "onboarding.started", category: "onboarding", occurredAt: t0 },
      { organizationId: "o", eventName: "activation.first_value", category: "product", occurredAt: t1 },
    ]);
    expect(s).toBe(330);
  });
});

describe("RC2 feature flags", () => {
  it("disabled flag returns false", () => {
    expect(evaluateFlag(undefined, { organizationId: "o" })).toBe(false);
    expect(evaluateFlag({ flagKey: "f", organizationId: "o", enabled: false, rolloutPercent: 100 }, { organizationId: "o" })).toBe(false);
  });

  it("100% rollout always true", () => {
    expect(evaluateFlag({ flagKey: "f", organizationId: "o", enabled: true, rolloutPercent: 100 }, { organizationId: "o" })).toBe(true);
  });

  it("deterministic bucketing", () => {
    const b1 = bucketOf("org-A", "flag-1");
    const b2 = bucketOf("org-A", "flag-1");
    expect(b1).toBe(b2);
    expect(b1).toBeGreaterThanOrEqual(0);
    expect(b1).toBeLessThan(100);
  });

  it("cohort gating", () => {
    const f = { flagKey: "f", organizationId: "o", enabled: true, rolloutPercent: 100, targetCohorts: ["wave-1"] };
    expect(evaluateFlag(f, { organizationId: "o", cohort: "wave-1" })).toBe(true);
    expect(evaluateFlag(f, { organizationId: "o", cohort: "wave-2" })).toBe(false);
  });

  it("registry stores per org", () => {
    const r = new FeatureFlagRegistry();
    r.upsert({ flagKey: "x", organizationId: "o1", enabled: true, rolloutPercent: 100 });
    expect(r.isEnabled("x", { organizationId: "o1" })).toBe(true);
    expect(r.isEnabled("x", { organizationId: "o2" })).toBe(false);
  });
});

describe("RC2 onboarding", () => {
  it("progress computes required + total", () => {
    const p = computeOnboardingProgress(["profile.completed", "workspace.dashboard"]);
    expect(p.total).toBe(ONBOARDING_STEPS.length);
    expect(p.completed).toBe(2);
    expect(p.requiredCompleted).toBe(2);
    expect(p.percent).toBeGreaterThan(0);
  });

  it("next step prefers required pending", () => {
    const step = nextRecommendedStep([]);
    expect(step?.required).toBe(true);
  });

  it("returns null when all done", () => {
    const all = ONBOARDING_STEPS.map((s) => s.key);
    expect(nextRecommendedStep(all)).toBeNull();
  });
});
