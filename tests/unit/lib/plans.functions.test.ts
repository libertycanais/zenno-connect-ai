import { describe, expect, it } from "vitest";
import {
  classifyPlanChange,
  pickPlanByCode,
  type PlanRow,
} from "@/lib/plans.functions";

const trial: PlanRow = {
  id: "p-trial",
  code: "trial",
  name: "Trial",
  description: null,
  price_cents: 0,
  currency: "BRL",
  interval: "month",
  trial_days: 15,
  features: {},
  limits: {},
  active: true,
  sort_order: 0,
};
const basico: PlanRow = { ...trial, id: "p-b", code: "basico", price_cents: 2999, sort_order: 10, trial_days: 0 };
const completo: PlanRow = { ...basico, id: "p-c", code: "completo", price_cents: 6999, sort_order: 20 };
const enterprise: PlanRow = { ...basico, id: "p-e", code: "enterprise", price_cents: 29900, sort_order: 30 };
const inactive: PlanRow = { ...basico, id: "p-old", code: "legacy_pro", active: false, sort_order: 5 };

const catalog = [trial, basico, completo, enterprise, inactive];

describe("plans.functions — pure helpers", () => {
  describe("pickPlanByCode", () => {
    it("returns the active plan for a valid code", () => {
      expect(pickPlanByCode(catalog, "basico")?.id).toBe("p-b");
      expect(pickPlanByCode(catalog, "completo")?.id).toBe("p-c");
    });

    it("returns undefined for inactive plan codes", () => {
      expect(pickPlanByCode(catalog, "legacy_pro")).toBeUndefined();
    });

    it("returns undefined for unknown code", () => {
      expect(pickPlanByCode(catalog, "does_not_exist")).toBeUndefined();
    });

    it("rejects invalid code formats", () => {
      expect(pickPlanByCode(catalog, "")).toBeUndefined();
      expect(pickPlanByCode(catalog, "with space")).toBeUndefined();
      expect(pickPlanByCode(catalog, "drop; table")).toBeUndefined();
    });
  });

  describe("classifyPlanChange", () => {
    it("classifies as activation when there is no previous plan", () => {
      expect(classifyPlanChange(undefined, basico)).toBe("activation");
    });

    it("classifies as same when target equals current", () => {
      expect(classifyPlanChange(basico, basico)).toBe("same");
    });

    it("classifies as upgrade when target has higher sort_order", () => {
      expect(classifyPlanChange(basico, completo)).toBe("upgrade");
      expect(classifyPlanChange(completo, enterprise)).toBe("upgrade");
      expect(classifyPlanChange(trial, basico)).toBe("upgrade");
    });

    it("classifies as downgrade when target has lower sort_order", () => {
      expect(classifyPlanChange(completo, basico)).toBe("downgrade");
      expect(classifyPlanChange(enterprise, trial)).toBe("downgrade");
    });
  });
});
