import type { KnowledgeModule } from "../types";
export const executiveKnowledge: KnowledgeModule = {
  domain: "executive", version: "1.0.0", rules: [
    { id: "exec.cac_ltv_below_3", domain: "executive", title: "LTV:CAC abaixo de 3x",
      description: "Unit economics comprometidos.",
      when: ["ltv/cac < 3"], recommend: ["reduzir_cac", "expandir_ltv"],
      severity: "warn", references: [], version: "1.0.0" },
  ],
};
