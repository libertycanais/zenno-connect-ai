import type { KnowledgeModule } from "../types";
export const trackingKnowledge: KnowledgeModule = {
  domain: "tracking", version: "1.0.0",
  rules: [
    { id: "tracking.coverage_low", domain: "tracking", title: "Cobertura de tracking baixa",
      description: "Menos de 70% dos eventos essenciais capturados. Decisões ficam cegas.",
      when: ["coverage < 0.7"],
      recommend: ["mapear_eventos_essenciais", "instalar_tag_manager", "validar_datalayer"],
      severity: "critical", references: [], version: "1.0.0" },
    { id: "tracking.duplicate_events", domain: "tracking", title: "Eventos duplicados",
      description: "Eventos duplicados inflam métricas e enganam otimização.",
      when: ["deduplication_ratio > 0.05"],
      recommend: ["ativar_deduplicacao", "revisar_event_id"],
      severity: "warn", references: [], version: "1.0.0" },
    { id: "tracking.utm_missing", domain: "tracking", title: "UTMs ausentes",
      description: "Sem UTMs consistentes, atribuição fica impossível.",
      when: ["utm_coverage < 0.5"],
      recommend: ["padronizar_utms", "template_de_campanha"],
      severity: "warn", references: [], version: "1.0.0" },
  ],
};
