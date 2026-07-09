import type { KnowledgeModule } from "../types";
export const financeKnowledge: KnowledgeModule = {
  domain: "finance", version: "1.0.0", rules: [
    { id: "finance.runway_low", domain: "finance", title: "Runway <6 meses",
      description: "Runway crítico: risco de operação.",
      when: ["runway < 6"], recommend: ["revisar_burn", "acelerar_receita"],
      severity: "critical", references: [], version: "1.0.0" },
  ],
};
