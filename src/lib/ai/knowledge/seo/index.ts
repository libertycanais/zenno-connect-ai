import type { KnowledgeModule } from "../types";
export const seoKnowledge: KnowledgeModule = {
  domain: "seo", version: "1.0.0", rules: [
    { id: "seo.title_missing", domain: "seo", title: "Title tag ausente",
      description: "Página sem <title> ou com título genérico.",
      when: ["title.length = 0 OR title = 'Untitled'"],
      recommend: ["gerar_title_unico"], severity: "warn", references: [], version: "1.0.0" },
    { id: "seo.description_missing", domain: "seo", title: "Meta description ausente",
      description: "Falta description reduz CTR na SERP.",
      when: ["description.length < 40"], recommend: ["gerar_description"],
      severity: "warn", references: [], version: "1.0.0" },
    { id: "seo.core_web_vitals_bad", domain: "seo", title: "Core Web Vitals ruins",
      description: "LCP > 2.5s / CLS > 0.1 impactam ranking e conversão.",
      when: ["lcp > 2500 OR cls > 0.1"], recommend: ["otimizar_lcp", "reservar_layout"],
      severity: "warn", references: [], version: "1.0.0" },
  ],
};
