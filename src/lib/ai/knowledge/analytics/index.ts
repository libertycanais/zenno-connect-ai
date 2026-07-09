import type { KnowledgeModule } from "../types";
export const analyticsKnowledge: KnowledgeModule = {
  domain: "analytics", version: "1.0.0", rules: [
    { id: "analytics.ga4_not_configured", domain: "analytics", title: "GA4 não configurado",
      description: "GA4 sem eventos-chave configurados.",
      when: ["ga4.configured = false"], recommend: ["configurar_ga4_eventos_conversao"],
      severity: "critical", references: [], version: "1.0.0" },
  ],
};
