import { describe, expect, it } from "vitest";
import {
  canCancel,
  computeRenewalInfo,
  computeTrialInfo,
  daysUntil,
  extractFeatureList,
  extractLimits,
  findCurrentPlan,
  formatCurrencyCents,
  isActive,
  labelForEvent,
  toneForEvent,
} from "@/lib/portal.helpers";
import type { PlanRow } from "@/lib/plans.functions";

const NOW = new Date("2026-07-09T12:00:00Z").getTime();
const inDays = (d: number) => new Date(NOW + d * 86400000).toISOString();

const basico: PlanRow = {
  id: "p-b",
  code: "basico",
  name: "Básico",
  description: null,
  price_cents: 2999,
  currency: "BRL",
  interval: "month",
  trial_days: 0,
  features: { whatsapp: true, seats: 3, tier: "starter" },
  limits: { leads: 1000, users: 3 },
  active: true,
  sort_order: 10,
};

describe("portal.helpers", () => {
  it("formatCurrencyCents formats BRL", () => {
    expect(formatCurrencyCents(2999)).toMatch(/29,99/);
    expect(formatCurrencyCents(0)).toMatch(/0,00/);
  });

  it("daysUntil handles null and past dates", () => {
    expect(daysUntil(null, NOW)).toBe(0);
    expect(daysUntil(inDays(-5), NOW)).toBe(0);
    expect(daysUntil(inDays(7), NOW)).toBe(7);
  });

  it("computeTrialInfo detects trialing status", () => {
    const info = computeTrialInfo(
      { status: "trialing", plan: "trial", trial_ends_at: inDays(3) },
      NOW,
    );
    expect(info.inTrial).toBe(true);
    expect(info.daysLeft).toBe(3);
  });

  it("computeTrialInfo returns false for active sub", () => {
    expect(computeTrialInfo({ status: "active", plan: "basico" }, NOW).inTrial).toBe(false);
    expect(computeTrialInfo(null, NOW).inTrial).toBe(false);
  });

  it("computeRenewalInfo returns willRenew=true for active w/o cancel_at_period_end", () => {
    const r = computeRenewalInfo(
      { status: "active", current_period_end: inDays(15), cancel_at_period_end: false },
      NOW,
    );
    expect(r.willRenew).toBe(true);
    expect(r.daysLeft).toBe(15);
  });

  it("computeRenewalInfo returns willRenew=false when cancel_at_period_end", () => {
    const r = computeRenewalInfo(
      { status: "active", current_period_end: inDays(10), cancel_at_period_end: true },
      NOW,
    );
    expect(r.willRenew).toBe(false);
  });

  it("isActive covers active and trialing", () => {
    expect(isActive({ status: "active" })).toBe(true);
    expect(isActive({ status: "trialing" })).toBe(true);
    expect(isActive({ status: "cancelled" })).toBe(false);
    expect(isActive(null)).toBe(false);
  });

  it("canCancel rules", () => {
    expect(canCancel({ status: "active", plan: "basico" })).toBe(true);
    expect(canCancel({ status: "trialing", plan: "trial" })).toBe(false);
    expect(canCancel({ status: "cancelled", plan: "basico" })).toBe(false);
    expect(canCancel({ status: "active", plan: "basico", cancel_at_period_end: true })).toBe(false);
    expect(canCancel(null)).toBe(false);
  });

  it("findCurrentPlan matches by code", () => {
    expect(findCurrentPlan([basico], { plan: "basico" })?.id).toBe("p-b");
    expect(findCurrentPlan([basico], { plan: "outro" })).toBeUndefined();
    expect(findCurrentPlan([basico], null)).toBeUndefined();
  });

  it("extractLimits maps object entries", () => {
    const out = extractLimits(basico);
    expect(out).toContainEqual({ key: "leads", value: "1000" });
    expect(out).toContainEqual({ key: "users", value: "3" });
    expect(extractLimits(undefined)).toEqual([]);
  });

  it("extractFeatureList handles booleans, strings and numbers", () => {
    const out = extractFeatureList(basico);
    expect(out.some((s) => s.toLowerCase().includes("whatsapp"))).toBe(true);
    expect(out.some((s) => s.includes("Seats: 3"))).toBe(true);
    expect(out.some((s) => s.toLowerCase().includes("starter"))).toBe(true);
  });

  it("labelForEvent + toneForEvent", () => {
    expect(labelForEvent("upgraded")).toBe("Upgrade de plano");
    expect(labelForEvent("unknown_event")).toBe("Unknown Event");
    expect(toneForEvent("payment_succeeded")).toBe("positive");
    expect(toneForEvent("payment_failed")).toBe("negative");
    expect(toneForEvent("downgraded")).toBe("warning");
    expect(toneForEvent("checkout_started")).toBe("neutral");
  });
});
