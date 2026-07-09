import type { KnowledgeModule } from "../types";
export const googlePoliciesKnowledge: KnowledgeModule = {
  domain: "google-policies", version: "1.0.0", rules: [
    { id: "gads.pol.disapproved_creative", domain: "google-policies",
      title: "Anúncio reprovado",
      description: "Anúncio reprovado por política do Google Ads.",
      when: ["ad.status = 'disapproved'"],
      recommend: ["revisar_texto_do_anuncio", "verificar_landing_page"],
      severity: "critical",
      references: ["https://support.google.com/adspolicy/"], version: "1.0.0" },
  ],
};
