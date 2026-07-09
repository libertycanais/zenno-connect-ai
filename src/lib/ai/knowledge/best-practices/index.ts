import type { KnowledgeModule } from "../types";
export const bestPracticesKnowledge: KnowledgeModule = {
  domain: "best-practices", version: "1.0.0", rules: [
    { id: "bp.hypothesis_first", domain: "best-practices",
      title: "Toda otimização parte de hipótese",
      description: "Mudanças em campanhas exigem hipótese, métrica e critério de sucesso.",
      when: [], recommend: ["formalizar_hipotese", "definir_kpi_alvo"],
      severity: "info", references: [], version: "1.0.0" },
    { id: "bp.one_change_at_a_time", domain: "best-practices",
      title: "Testar uma mudança por vez",
      description: "Testes com múltiplas variáveis geram atribuição inválida.",
      when: [], recommend: ["isolar_variavel_testada"], severity: "info",
      references: [], version: "1.0.0" },
  ],
};
