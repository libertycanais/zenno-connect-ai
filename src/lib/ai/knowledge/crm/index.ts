import type { KnowledgeModule } from "../types";
export const crmKnowledge: KnowledgeModule = {
  domain: "crm", version: "1.0.0", rules: [
    { id: "crm.stale_leads", domain: "crm", title: "Leads sem interação >14d",
      description: "Lead sem contato há mais de 14 dias tende a esfriar.",
      when: ["days_since_last_touch > 14"], recommend: ["sequencia_reengajamento"],
      severity: "warn", references: [], version: "1.0.0" },
    { id: "crm.mql_to_sql_low", domain: "crm", title: "MQL→SQL abaixo do p25",
      description: "Qualificação ruim ou passagem lenta para vendas.",
      when: ["mql_to_sql < benchmark.funnel.mql_to_sql.p25"],
      recommend: ["revisar_qualificacao", "sla_de_repasse"],
      severity: "warn", references: [], version: "1.0.0" },
  ],
};
