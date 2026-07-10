// FEATURE — Marketing Intelligence · Recommendation Pipeline
import type {
  CampaignFacts, IntelligenceRecommendation, MarketingHealthReport, TrackingFacts,
} from "../types";
import type { MarketingProvider } from "../../contracts/assets";

function id(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

export function buildRecommendations(input: {
  organizationId: string;
  provider: MarketingProvider;
  campaigns: CampaignFacts[];
  tracking?: TrackingFacts;
  health: MarketingHealthReport;
}): IntelligenceRecommendation[] {
  const { organizationId, provider, campaigns, tracking, health } = input;
  const now = new Date().toISOString();
  const recs: IntelligenceRecommendation[] = [];

  // R1 — campanhas queimando budget sem conversão
  const wasted = campaigns.filter((c) => c.status === "enabled" && c.spendCents > 0 && c.conversions === 0);
  if (wasted.length) {
    const savings = wasted.reduce((s, c) => s + c.spendCents, 0);
    recs.push({
      id: id("rec"), organizationId, provider,
      problem: `${wasted.length} campanha(s) consumindo orçamento sem gerar conversões`,
      cause: "Configuração de segmentação, criativo ou tracking incorretos",
      impact: `Desperdício mensal estimado de ${(savings / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}`,
      priority: savings > 100_000 ? "critical" : "high",
      financialValueCents: savings,
      recommendation: "Pausar campanhas sem conversão nos últimos 7 dias e revisar tracking",
      nextAction: `Revisar campanhas: ${wasted.slice(0, 3).map((c) => c.name).join(", ")}`,
      confidence: 0.82,
      sources: ["campaign_facts", "tracking_facts"],
      createdAt: now,
    });
  }

  // R2 — campanhas com ROAS alto → escalar
  const winners = campaigns.filter((c) => (c.roas ?? 0) >= 3 && c.status === "enabled");
  if (winners.length) {
    const potentialRevenue = winners.reduce((s, c) => s + Math.round(c.revenueCents * 0.3), 0);
    recs.push({
      id: id("rec"), organizationId, provider,
      problem: `${winners.length} campanha(s) com ROAS ≥ 3× e orçamento limitado`,
      cause: "Budget insuficiente para capturar demanda disponível",
      impact: `Receita potencial adicional de ${(potentialRevenue / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}/mês`,
      priority: "high",
      financialValueCents: potentialRevenue,
      recommendation: "Aumentar budget das campanhas vencedoras em 30% e monitorar por 14 dias",
      nextAction: `Escalar: ${winners.slice(0, 3).map((c) => c.name).join(", ")}`,
      confidence: 0.78,
      sources: ["campaign_facts", "benchmarks"],
      createdAt: now,
    });
  }

  // R3 — tracking gap
  if (tracking && (!tracking.conversionsConfigured || tracking.coverage < 0.7)) {
    recs.push({
      id: id("rec"), organizationId, provider,
      problem: "Cobertura de tracking insuficiente para atribuição confiável",
      cause: !tracking.conversionsConfigured ? "Conversões não configuradas" : `Cobertura em ${Math.round(tracking.coverage * 100)}%`,
      impact: "Otimização automática do Google Ads operando com dados incompletos",
      priority: "high",
      financialValueCents: 0,
      recommendation: "Configurar conversões primárias e garantir tag em todas as páginas de conversão",
      nextAction: "Auditar setup GTM + conversões no Google Ads",
      confidence: 0.9,
      sources: ["tracking_facts"],
      createdAt: now,
    });
  }

  // R4 — health crítico
  const critical = health.components.filter((c) => c.severity === "critical");
  for (const c of critical) {
    recs.push({
      id: id("rec"), organizationId, provider,
      problem: `Dimensão ${c.dimension} em estado crítico`,
      cause: c.reasons.join("; ") || "Sinais insuficientes",
      impact: "Risco imediato à performance da conta",
      priority: "critical",
      financialValueCents: 0,
      recommendation: `Investigar e corrigir dimensão ${c.dimension} na próxima janela operacional`,
      nextAction: `Abrir diagnóstico de ${c.dimension}`,
      confidence: 0.7,
      sources: ["health_report"],
      createdAt: now,
    });
  }

  return recs;
}
