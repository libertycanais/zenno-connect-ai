import { describe, expect, it } from "vitest";
import {
  buildDailySeries,
  buildFunnel,
  computeAcquisitionKPIs,
  computeBillingKPIs,
  computeUnitEconomics,
  groupBySource,
  toCSV,
  toExcelXML,
  type LeadLite,
  type SubscriptionLite,
} from "@/lib/executive-dashboard.helpers";

const subs: SubscriptionLite[] = [
  { id: "a", status: "active", plan: "pro", price_cents: 9900, created_at: "2026-01-01", canceled_at: null, current_period_end: null, trial_ends_at: null },
  { id: "b", status: "active", plan: "pro", price_cents: 9900, created_at: "2026-02-01", canceled_at: null, current_period_end: null, trial_ends_at: null },
  { id: "c", status: "trialing", plan: "starter", price_cents: 2900, created_at: "2026-06-01", canceled_at: null, current_period_end: null, trial_ends_at: null },
  { id: "d", status: "canceled", plan: "pro", price_cents: 9900, created_at: "2026-01-01", canceled_at: new Date().toISOString(), current_period_end: null, trial_ends_at: null },
];

describe("executive-dashboard.helpers — billing KPIs", () => {
  it("computes MRR/ARR from active subscriptions", () => {
    const k = computeBillingKPIs(subs);
    expect(k.active).toBe(2);
    expect(k.mrr).toBe(198);
    expect(k.arr).toBe(198 * 12);
    expect(k.trialing).toBe(1);
    expect(k.ticketMedio).toBe(99);
  });

  it("computes churn rate over last 30 days", () => {
    const k = computeBillingKPIs(subs);
    expect(k.canceledLast30d).toBe(1);
    // 1 / (2 active + 1 canceled) = 0.3333
    expect(k.churnRate).toBeCloseTo(0.3333, 3);
  });

  it("handles empty inputs safely", () => {
    const k = computeBillingKPIs([]);
    expect(k).toEqual({
      mrr: 0, arr: 0, active: 0, trialing: 0, canceledLast30d: 0, churnRate: 0, ticketMedio: 0,
    });
  });
});

describe("executive-dashboard.helpers — acquisition KPIs", () => {
  const leads: LeadLite[] = [
    { status: "novo", created_at: "2026-07-01" },
    { status: "qualificado", created_at: "2026-07-02" },
    { status: "qualificado", created_at: "2026-07-02" },
    { status: "cliente", created_at: "2026-07-03" },
    { status: "perdido", created_at: "2026-07-04" },
  ];
  it("computes conversion and qualification rates", () => {
    const k = computeAcquisitionKPIs(leads);
    expect(k.leads).toBe(5);
    expect(k.qualificados).toBe(2);
    expect(k.clientes).toBe(1);
    expect(k.conversionRate).toBeCloseTo(0.2, 3);
    expect(k.qualificationRate).toBeCloseTo(0.4, 3);
  });
});

describe("executive-dashboard.helpers — unit economics", () => {
  it("cac = spend / new customers", () => {
    const e = computeUnitEconomics({ marketingSpend: 1000, newCustomers: 10, ticketMedio: 100, churnRate: 0.1 });
    expect(e.cac).toBe(100);
    expect(e.ltv).toBe(1000);
    expect(e.roi).toBeCloseTo(9, 2);
    expect(e.paybackMonths).toBe(1);
  });
  it("ltv uses 24-month horizon when churn=0", () => {
    const e = computeUnitEconomics({ marketingSpend: 0, newCustomers: 0, ticketMedio: 50, churnRate: 0 });
    expect(e.ltv).toBe(1200);
    expect(e.cac).toBe(0);
    expect(e.roi).toBe(0);
  });
});

describe("executive-dashboard.helpers — funnel", () => {
  it("cascades counts through stages", () => {
    const leads: LeadLite[] = [
      { status: "novo", created_at: "" },
      { status: "qualificado", created_at: "" },
      { status: "cliente", created_at: "" },
      { status: "perdido", created_at: "" },
    ];
    const f = buildFunnel(leads);
    expect(f[0]).toMatchObject({ stage: "novo", count: 3 });
    expect(f[1]).toMatchObject({ stage: "qualificado", count: 2 });
    expect(f[2]).toMatchObject({ stage: "cliente", count: 1 });
  });
});

describe("executive-dashboard.helpers — series & grouping", () => {
  it("buildDailySeries produces correct number of buckets", () => {
    const now = new Date("2026-07-10T00:00:00Z");
    const series = buildDailySeries(3, {
      leads: [{ status: "novo", created_at: "2026-07-09T12:00:00Z" }],
      conversions: [{ event_name: "purchase", value: 10, created_at: "2026-07-08T12:00:00Z" }],
      finance: [{ kind: "income", amount: 42, due_date: "2026-07-10" }],
    }, now);
    expect(series).toHaveLength(3);
    expect(series[0].date).toBe("2026-07-08");
    expect(series[2].date).toBe("2026-07-10");
    expect(series[1].leads).toBe(1);
    expect(series[0].conversions).toBe(1);
    expect(series[2].revenue).toBe(42);
  });
  it("groupBySource defaults missing utm to 'direct'", () => {
    const g = groupBySource([
      { status: "novo", created_at: "", utm_source: "Google" },
      { status: "novo", created_at: "", utm_source: "google" },
      { status: "novo", created_at: "" },
    ]);
    expect(g[0]).toEqual({ source: "google", count: 2 });
    expect(g[1]).toEqual({ source: "direct", count: 1 });
  });
});

describe("executive-dashboard.helpers — exports", () => {
  const rows = [
    { date: "2026-07-01", leads: 3, note: "a,b" },
    { date: "2026-07-02", leads: 5, note: 'quote"' },
  ];
  it("toCSV escapes commas and quotes (RFC 4180)", () => {
    const out = toCSV(rows);
    expect(out.split("\r\n")).toHaveLength(3);
    expect(out).toContain('"a,b"');
    expect(out).toContain('"quote"""');
  });
  it("toCSV returns empty string for empty input", () => {
    expect(toCSV([])).toBe("");
  });
  it("toExcelXML produces valid SpreadsheetML markup", () => {
    const xml = toExcelXML(rows);
    expect(xml).toContain("<?mso-application");
    expect(xml).toContain("<Worksheet");
    expect(xml).toContain("<Cell><Data");
  });
});
