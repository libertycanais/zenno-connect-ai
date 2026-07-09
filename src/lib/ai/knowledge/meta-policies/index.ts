import type { KnowledgeModule } from "../types";
export const metaPoliciesKnowledge: KnowledgeModule = {
  domain: "meta-policies", version: "1.0.0", rules: [
    { id: "meta.pol.prohibited_categories", domain: "meta-policies",
      title: "Categoria proibida detectada",
      description: "Uso de categorias sensíveis proibidas pelo Meta Ads Policy.",
      when: ["contains_prohibited_category = true"],
      recommend: ["revisar_criativo", "consultar_meta_ads_policies"],
      severity: "critical", references: ["https://transparency.meta.com/policies/ad-standards/"],
      version: "1.0.0" },
  ],
};
