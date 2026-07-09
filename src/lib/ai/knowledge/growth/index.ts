import type { KnowledgeModule } from "../types";
export const growthKnowledge: KnowledgeModule = {
  domain: "growth", version: "1.0.0", rules: [
    { id: "growth.no_activation", domain: "growth", title: "Ativação baixa",
      description: "Menos de 20% dos novos usuários atingem evento de ativação.",
      when: ["activation_rate < 0.2"],
      recommend: ["reescrever_onboarding", "email_de_boas_vindas"],
      severity: "warn", references: [], version: "1.0.0" },
  ],
};
