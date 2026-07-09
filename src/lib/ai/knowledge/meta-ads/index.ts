import type { KnowledgeModule } from "../types";
export const metaAdsKnowledge: KnowledgeModule = {
  domain: "meta-ads", version: "1.0.0",
  rules: [
    { id: "meta.ctr_below_p25", domain: "meta-ads", title: "CTR abaixo do p25",
      description: "CTR abaixo do p25 do benchmark indica criativos fracos ou público mal segmentado.",
      when: ["ctr < benchmark.meta.ctr.p25"],
      recommend: ["revisar_criativos", "testar_novo_publico", "renovar_hook"],
      severity: "warn", references: ["https://www.facebook.com/business/help"], version: "1.0.0" },
    { id: "meta.roas_below_1", domain: "meta-ads", title: "ROAS abaixo de 1x",
      description: "Campanha está queimando dinheiro; retorno inferior ao investimento.",
      when: ["roas < 1"], recommend: ["pausar_campanha", "reavaliar_oferta", "reduzir_orcamento"],
      severity: "critical", references: [], version: "1.0.0" },
    { id: "meta.frequency_high", domain: "meta-ads", title: "Frequência alta",
      description: "Frequência acima de 4 causa fadiga de criativo.",
      when: ["frequency > 4"], recommend: ["ampliar_publico", "atualizar_criativos"],
      severity: "warn", references: [], version: "1.0.0" },
    { id: "meta.pixel_missing", domain: "meta-ads", title: "Pixel/CAPI ausente",
      description: "Sem Pixel + CAPI, otimização de conversões é inviável.",
      when: ["tracking.pixel = false OR tracking.capi = false"],
      recommend: ["instalar_pixel", "configurar_capi", "validar_deduplicacao"],
      severity: "critical", references: [], version: "1.0.0" },
  ],
};
