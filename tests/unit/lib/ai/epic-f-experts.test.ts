import { describe, it, expect } from "vitest";
import { salesExpert } from "@/lib/ai/experts/sales";
import { financeExpert } from "@/lib/ai/experts/finance";
import { customerSuccessExpert } from "@/lib/ai/experts/customer-success";
import type { ExpertRunInput } from "@/lib/ai/experts/types";

function baseInput(): ExpertRunInput {
  return {
    organizationId: "00000000-0000-0000-0000-000000000001",
    focus: "diagnóstico geral",
    kpis: [{ kpi: "roas", value: 0.8, currency: "BRL", period: "30d", provenance: [] } as any],
    triggeredRules: [{
      id: "sales.pipeline_stalled", domain: "crm", version: "1.0.0", title: "Funil estagnado",
      description: "Baixa movimentação entre estágios.", severity: "warn",
      recommend: ["revisar_scripts", "acelerar_followup"],
    } as any],
  };
}

describe("EPIC F · new Experts", () => {
  it("SalesExpert produz evidence + recommendations", () => {
    const out = salesExpert.run(baseInput());
    expect(out.expertId).toBe("sales");
    expect(out.recommendations.length).toBeGreaterThan(0);
    expect(out.playbooks.length).toBe(out.recommendations.length);
  });

  it("FinanceExpert reutiliza pipeline padrão", () => {
    const out = financeExpert.run(baseInput());
    expect(out.expertId).toBe("finance");
    expect(out.evidence).toBeDefined();
  });

  it("CustomerSuccessExpert produz playbooks válidos", () => {
    const out = customerSuccessExpert.run(baseInput());
    expect(out.expertId).toBe("customer-success");
    expect(out.playbooks[0].problem).toBeDefined();
  });
});
