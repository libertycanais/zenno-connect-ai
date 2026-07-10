// EPIC J — Product Layer tests
import { describe, expect, it } from "vitest";
import {
  ActionCenter, RecommendationCenter, InsightFeed, WidgetEngine, DashboardComposer,
  NotificationCenter, NullTransport, ExecutiveWorkspace, PreferencesStore, BookmarkStore,
  filters, applyFeedFilter, filterRecommendations, filterActions,
  bundleToMarkdown, bundleToJson, registerDefaultWidgets,
  type ProductAction, type ProductRecommendation, type InsightItem, type NotificationRequest,
} from "@/lib/product";
import { buildExecutiveReport } from "@/lib/ai/executive";

const ORG_A = "org_j_a";
const ORG_B = "org_j_b";
const USER = "user_j_1";

const baseAction: Omit<ProductAction, "id" | "status" | "createdAt" | "updatedAt"> = {
  organizationId: ORG_A,
  title: "Increase SEO budget",
  description: "Reallocate 10% of paid to organic",
  priority: 2,
  impact: "warn",
  estimatedGainCents: 250_000,
  estimatedCostCents: 50_000,
  risk: "low",
  confidence: 0.7,
  requiredPermissions: ["owner", "admin"],
  domain: "marketing",
};

describe("Epic J · ActionCenter", () => {
  it("creates action in 'suggested' and transitions through approval flow", () => {
    const ac = new ActionCenter();
    const a = ac.create(baseAction);
    expect(a.status).toBe("suggested");
    expect(ac.canAutoExecute()).toBe(false);
    const pending = ac.transition({ organizationId: ORG_A }, a.id, "pending_approval");
    expect(pending.status).toBe("pending_approval");
    const approved = ac.transition({ organizationId: ORG_A }, a.id, "approved", USER);
    expect(approved.status).toBe("approved");
    expect(approved.approvedBy).toBe(USER);
    const scheduled = ac.transition({ organizationId: ORG_A }, a.id, "scheduled");
    expect(scheduled.status).toBe("scheduled");
    const running = ac.transition({ organizationId: ORG_A }, a.id, "in_progress");
    expect(running.status).toBe("in_progress");
    const done = ac.transition({ organizationId: ORG_A }, a.id, "executed");
    expect(done.status).toBe("executed");
    expect(done.executedAt).toBeDefined();
  });
  it("rejects invalid transitions", () => {
    const ac = new ActionCenter();
    const a = ac.create(baseAction);
    expect(() => ac.transition({ organizationId: ORG_A }, a.id, "executed")).toThrow(/invalid_transition/);
  });
  it("is org-scoped (no cross-tenant leak)", () => {
    const ac = new ActionCenter();
    ac.create(baseAction);
    ac.create({ ...baseAction, organizationId: ORG_B });
    expect(ac.list({ organizationId: ORG_A }).length).toBe(1);
    expect(ac.list({ organizationId: ORG_B }).length).toBe(1);
  });
});

describe("Epic J · RecommendationCenter", () => {
  const rc = new RecommendationCenter();
  const now = new Date().toISOString();
  const rec = (id: string, domain: ProductRecommendation["domain"], impact: number, conf: number, org = ORG_A): ProductRecommendation => ({
    organizationId: org, id, domain, title: `t_${id}`, summary: "", origin: "marketing",
    evidenceIds: [], playbookIds: [], impactCents: impact, confidence: conf, createdAt: now,
  });
  rc.ingestMany([rec("r1", "marketing", 1_000, 0.8), rec("r2", "seo", 500, 0.4), rec("r3", "marketing", 3_000, 0.5), rec("r4", "seo", 200, 0.9, ORG_B)]);
  it("groups by domain", () => {
    const g = rc.groupByDomain({ organizationId: ORG_A });
    expect(g.marketing.length).toBe(2);
    expect(g.seo.length).toBe(1);
  });
  it("filters by domain and minConfidence", () => {
    expect(rc.list({ organizationId: ORG_A }, { domain: "marketing" }).length).toBe(2);
    expect(rc.list({ organizationId: ORG_A }, { minConfidence: 0.7 }).length).toBe(1);
  });
  it("topN ranks by impact*confidence", () => {
    const top = rc.topN({ organizationId: ORG_A }, 1);
    expect(top[0]!.id).toBe("r3"); // 3000*0.5=1500 > 1000*0.8=800
  });
  it("org isolation", () => {
    expect(rc.list({ organizationId: ORG_B }).length).toBe(1);
  });
});

describe("Epic J · InsightFeed", () => {
  const feed = new InsightFeed();
  const mk = (id: string, kind: InsightItem["kind"], sev: InsightItem["severity"], org = ORG_A, at?: string): InsightItem => ({
    organizationId: org, id, kind, title: `t_${id}`, summary: `s_${id}`, severity: sev, refs: [],
    domain: "marketing", occurredAt: at ?? new Date().toISOString(),
  });
  feed.publish(mk("i1", "signal", "critical"));
  feed.publish(mk("i2", "playbook", "info"));
  feed.publish(mk("i3", "signal", "warn", ORG_B));
  it("filters by severity/kind", () => {
    expect(feed.list({ organizationId: ORG_A }, { severities: ["critical"] }).length).toBe(1);
    expect(feed.list({ organizationId: ORG_A }, { kinds: ["playbook"] }).length).toBe(1);
  });
  it("respects org boundary", () => {
    expect(feed.list({ organizationId: ORG_B }).length).toBe(1);
  });
  it("applyFeedFilter matches search", () => {
    const items = feed.list({ organizationId: ORG_A });
    expect(applyFeedFilter(items, { search: "i1" }).length).toBe(1);
  });
});

describe("Epic J · WidgetEngine + DashboardComposer", () => {
  const engine = new WidgetEngine();
  registerDefaultWidgets(engine);
  it("registers 9 default widget renderers", () => {
    expect(engine.list().length).toBe(9);
  });
  it("validates unknown types", () => {
    const v = engine.validate({ id: "w1", type: "wat" as never, title: "x", size: "md", position: 0 });
    expect(v.ok).toBe(false);
  });
  it("composes/edits dashboards preserving position and org isolation", () => {
    const dc = new DashboardComposer(engine);
    const d = dc.create({ organizationId: ORG_A }, "home", [
      { id: "w1", type: "kpis", title: "KPIs", size: "lg", position: 0 },
      { id: "w2", type: "executive_score", title: "Score", size: "md", position: 5 },
    ]);
    expect(d.widgets.map((w) => w.position)).toEqual([0, 1]);
    const d2 = dc.addWidget({ organizationId: ORG_A }, d.id, { id: "w3", type: "forecast", title: "F", size: "md", position: 0 });
    expect(d2.widgets.map((w) => w.id)).toEqual(["w1", "w2", "w3"]);
    const d3 = dc.reorder({ organizationId: ORG_A }, d.id, ["w3", "w1", "w2"]);
    expect(d3.widgets.map((w) => w.id)).toEqual(["w3", "w1", "w2"]);
    const d4 = dc.removeWidget({ organizationId: ORG_A }, d.id, "w1");
    expect(d4.widgets.length).toBe(2);
    expect(dc.list({ organizationId: ORG_B }).length).toBe(0);
  });
  it("rejects widgets with invalid type", () => {
    const dc = new DashboardComposer(engine);
    expect(() => dc.create({ organizationId: ORG_A }, "x", [
      { id: "w", type: "nope" as never, title: "x", size: "sm", position: 0 },
    ])).toThrow();
  });
});

describe("Epic J · NotificationCenter", () => {
  it("skips when no transport is registered", async () => {
    const nc = new NotificationCenter();
    const n: NotificationRequest = {
      organizationId: ORG_A, id: "n1", channel: "email", title: "hi", body: "b",
      severity: "info", audience: ["u"], refs: [], createdAt: new Date().toISOString(),
    };
    nc.enqueue(n);
    const results = await nc.flush({ organizationId: ORG_A });
    expect(results[0]!.status).toBe("skipped");
    expect(results[0]!.reason).toBe("no_transport");
  });
  it("uses registered transport and records history", async () => {
    const nc = new NotificationCenter();
    nc.register(new NullTransport("in_app"));
    const n: NotificationRequest = {
      organizationId: ORG_A, id: "n2", channel: "in_app", title: "hi", body: "b",
      severity: "info", audience: ["u"], refs: [], createdAt: new Date().toISOString(),
    };
    nc.enqueue(n);
    const results = await nc.flush({ organizationId: ORG_A });
    expect(results[0]!.status).toBe("queued");
    expect(nc.historyFor({ organizationId: ORG_A }).length).toBe(1);
  });
});

describe("Epic J · ExecutiveWorkspace", () => {
  const rc = new RecommendationCenter();
  const feed = new InsightFeed();
  const ws = new ExecutiveWorkspace(rc, feed);
  const rep = buildExecutiveReport({
    organizationId: ORG_A, topic: "diag",
    kpis: [{ kpi: "roas", label: "ROAS", value: 2, unit: "x", severity: "warn", delta: -0.1 }],
    expertOutputs: [{
      expertId: "marketing", evidence: { items: [], generatedAt: "" } as never,
      recommendations: [{ recommendationId: "r_e", id: "r_e", title: "Fix", expectedImpactCents: 1_000, confidence: 0.6 }] as never,
      playbooks: [] as never, generatedAt: new Date().toISOString(),
    }],
  });
  ws.publishReport(rep);
  it("home view exposes narrative and score", () => {
    const view = ws.home({ organizationId: ORG_A });
    expect(view.brief).not.toBeNull();
    expect(view.score).not.toBeNull();
    expect(view.latestReportId).toBe(rep.reportId);
  });
  it("timeline sorts across kinds", () => {
    rc.ingest({ organizationId: ORG_A, id: "r_t", domain: "marketing", title: "T", summary: "", origin: "marketing", evidenceIds: [], playbookIds: [], impactCents: 100, confidence: 0.5, createdAt: new Date().toISOString() });
    feed.publish({ organizationId: ORG_A, id: "i_t", kind: "signal", title: "S", summary: "", severity: "info", refs: [], domain: "marketing", occurredAt: new Date().toISOString() });
    const t = ws.timeline({ organizationId: ORG_A });
    expect(t.length).toBeGreaterThan(0);
  });
  it("org isolation on home view", () => {
    const view = ws.home({ organizationId: ORG_B });
    expect(view.brief).toBeNull();
    expect(view.latestReportId).toBeNull();
  });
});

describe("Epic J · Preferences + Bookmarks + Filters + Reports", () => {
  it("prefs upsert is per-user per-org", () => {
    const p = new PreferencesStore();
    p.upsert({ organizationId: ORG_A }, USER, { theme: "dark" });
    expect(p.get({ organizationId: ORG_A }, USER)?.theme).toBe("dark");
    expect(p.get({ organizationId: ORG_B }, USER)).toBeNull();
  });
  it("bookmarks are per-user, removable, org-scoped", () => {
    const b = new BookmarkStore();
    const bm = b.add({ organizationId: ORG_A, userId: USER, refKind: "recommendation", refId: "r1" });
    expect(b.listForUser({ organizationId: ORG_A }, USER).length).toBe(1);
    expect(b.remove({ organizationId: ORG_A }, bm.id)).toBe(true);
    expect(b.listForUser({ organizationId: ORG_A }, USER).length).toBe(0);
  });
  it("filter combinators compose", () => {
    const items = [
      { title: "a", summary: "x", domain: "marketing" as const, severity: "info" as const },
      { title: "b", summary: "y", domain: "seo" as const, severity: "warn" as const },
    ];
    const preds = filters.compose(filters.byDomain<typeof items[number]>("marketing"), filters.bySearch<typeof items[number]>("a"));
    expect(items.filter(preds).length).toBe(1);
    expect(filterRecommendations([], { domain: "seo" }).length).toBe(0);
    expect(filterActions([], { minConfidence: 0.5 }).length).toBe(0);
  });
  it("bundle exports markdown + json", () => {
    const md = bundleToMarkdown({ organizationId: ORG_A, generatedAt: new Date().toISOString(), executive: null, recommendations: [], actions: [], insights: [] });
    expect(md).toContain("Product Report");
    const json = bundleToJson({ organizationId: ORG_A, generatedAt: new Date().toISOString(), executive: null, recommendations: [], actions: [], insights: [] });
    expect(() => JSON.parse(json)).not.toThrow();
  });
});
