import type { KnowledgeModule } from "../types";
export const croKnowledge: KnowledgeModule = {
  domain: "cro", version: "1.0.0", rules: [
    { id: "cro.lp_cvr_low", domain: "cro", title: "Landing page com CVR baixo",
      description: "CVR abaixo do p25 do benchmark. LP não converte tráfego pago.",
      when: ["lp_cvr < benchmark.cro.landing_page_cvr.p25"],
      recommend: ["remover_atritos_formulario", "cta_acima_da_dobra", "provas_sociais"],
      severity: "warn", references: [], version: "1.0.0" },
    { id: "cro.checkout_abandono", domain: "cro", title: "Abandono no checkout",
      description: "Taxa de conclusão do checkout abaixo do p25.",
      when: ["checkout_cvr < benchmark.cro.checkout_cvr.p25"],
      recommend: ["habilitar_pagamento_1_clique", "reduzir_campos"],
      severity: "critical", references: [], version: "1.0.0" },
  ],
};
