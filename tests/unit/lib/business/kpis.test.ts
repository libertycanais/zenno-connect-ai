// EPIC C · Business KPI Engine — testes unitários (funções puras)
import { describe, it, expect } from "vitest";
import {
  cac, ltv, roi, roas, cpa, ctr, cpm, cpc, mrr, arr, arpu,
  payback, burn, runway, retention, churn, ticket, pipeline,
  healthScore,
} from "@/lib/business";
import { compare } from "@/lib/business/benchmarks";
import { computeScore } from "@/lib/business/scoring";

describe("Business KPIs — happy path & edge cases", () => {
  it("cac divide corretamente e produz severity", () => {
    const r = cac({ totalAcquisitionCostCents: 10_000_00, newCustomers: 100 });
    expect(r.value).toBe(100_00);
    expect(r.severity).toBe("ok");
  });
  it("cac lida com divisão por zero", () => {
    const r = cac({ totalAcquisitionCostCents: 1000, newCustomers: 0 });
    expect(r.value).toBeNull();
    expect(r.severity).toBe("unknown");
    expect(r.warnings[0].code).toBe("DIVISION_BY_ZERO");
  });
  it("ltv aplica margem e churn", () => {
    const r = ltv({ arpuCents: 100_00, grossMargin: 0.6, churnRate: 0.05 });
    expect(r.value).toBe((100_00 * 0.6) / 0.05);
  });
  it("roi/roas/cpa/ctr/cpm/cpc — divisões", () => {
    expect(roi({ revenueCents: 2000, costCents: 1000 }).value).toBe(1);
    expect(roas({ revenueCents: 4000, adSpendCents: 1000 }).value).toBe(4);
    expect(cpa({ adSpendCents: 500_00, conversions: 10 }).value).toBe(50_00);
    expect(ctr({ clicks: 20, impressions: 1000 }).value).toBe(0.02);
    expect(cpm({ adSpendCents: 500_00, impressions: 100_000 }).value).toBe(5_00);
    expect(cpc({ adSpendCents: 500_00, clicks: 100 }).value).toBe(5_00);
  });
  it("mrr/arr/arpu/payback/burn/runway", () => {
    expect(mrr({ activeSubscriptionCentsPerMonth: [100_00, 200_00] }).value).toBe(300_00);
    expect(arr({ mrrCents: 100_00 }).value).toBe(1200_00);
    expect(arpu({ revenueCents: 1000_00, users: 100 }).value).toBe(10_00);
    expect(payback({ cacCents: 300_00, monthlyRevenuePerCustomerCents: 100_00, grossMargin: 0.5 }).value).toBe(6);
    expect(burn({ monthlyExpensesCents: 500_00, monthlyRevenueCents: 300_00 }).value).toBe(200_00);
    expect(runway({ cashCents: 900_00, monthlyBurnCents: 100_00 }).value).toBe(9);
  });
  it("runway retorna infinito quando burn <= 0", () => {
    const r = runway({ cashCents: 100, monthlyBurnCents: 0 });
    expect(r.value).toBe(Number.POSITIVE_INFINITY);
    expect(r.severity).toBe("ok");
  });
  it("retention/churn/ticket/pipeline", () => {
    expect(retention({ retained: 90, initialCohort: 100 }).value).toBe(0.9);
    expect(churn({ lost: 5, initialCohort: 100 }).value).toBe(0.05);
    expect(ticket({ revenueCents: 1_000_00, orders: 10 }).value).toBe(100_00);
    expect(pipeline({ deals: [{ valueCents: 100_00, probability: 0.5 }, { valueCents: 200_00, probability: 1 }] }).value).toBe(250_00);
  });
});

describe("Health Score & Scoring", () => {
  it("healthScore combina 10 componentes e retorna 0..100", () => {
    const r = healthScore({
      roas: 5, roi: 1.2, cac: 8_000_00, ltv: 60_000_00, ctr: 0.02,
      conversionRate: 0.03, trackingCoverage: 0.9, dataQuality: 0.85,
      budgetUtilization: 0.75, historyMonths: 4,
    });
    expect(r.value).toBeGreaterThan(0);
    expect(r.value).toBeLessThanOrEqual(100);
    expect(r.components.length).toBe(10);
  });
  it("computeScore normaliza pesos", () => {
    expect(computeScore([{ name: "a", weight: 1, score: 0.5 }])).toBe(0.5);
    expect(computeScore([{ name: "a", weight: 0, score: 1 }])).toBe(0);
  });
});

describe("Benchmarks", () => {
  it("compare devolve bucket coerente", () => {
    const c = compare("meta.roas", 6);
    expect(c.bucket).toBe("above_p75");
    expect(c.percentileEstimate).toBeGreaterThan(75);
  });
  it("compare abaixo do p25", () => {
    const c = compare("meta.ctr", 0.001);
    expect(c.bucket).toBe("below_p25");
  });
});
