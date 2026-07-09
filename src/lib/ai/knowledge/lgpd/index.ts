import type { KnowledgeModule } from "../types";
export const lgpdKnowledge: KnowledgeModule = {
  domain: "lgpd", version: "1.0.0", rules: [
    { id: "lgpd.consent_missing", domain: "lgpd", title: "Consentimento ausente",
      description: "Coleta de dados sem consentimento explícito viola a LGPD.",
      when: ["consent.captured = false"], recommend: ["implantar_banner_consent"],
      severity: "critical", references: ["https://www.gov.br/anpd"], version: "1.0.0" },
    { id: "lgpd.retention_policy_missing", domain: "lgpd", title: "Política de retenção ausente",
      description: "Dados pessoais precisam de política de retenção declarada.",
      when: ["retention_policy = null"], recommend: ["definir_retention_policy"],
      severity: "warn", references: [], version: "1.0.0" },
  ],
};
