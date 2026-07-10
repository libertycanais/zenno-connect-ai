// FEATURE — Marketing Intelligence · Health Engine (pure)
import type {
  CampaignFacts, TrackingFacts, MarketingHealthReport,
  HealthComponent, IntelligenceSeverity,
} from "../types";

function classify(score: number): IntelligenceSeverity {
  if (score >= 85) return "excellent";
  if (score >= 70) return "good";
  if (score >= 50) return "attention";
  return "critical";
}

function clamp(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

export function scoreCampaigns(camps: CampaignFacts[]): HealthComponent {
  const reasons: string[] = [];
  if (camps.length === 0) {
    return { dimension: "campaign", score: 0, severity: "critical", reasons: ["Nenhuma campanha ativa"] };
  }
  const enabled = camps.filter((c) => c.status === "enabled");
  const ratio = enabled.length / camps.length;
  const roas = camps.reduce((s, c) => s + (c.roas ?? 0), 0) / camps.length;
  const activityScore = ratio * 60;
  const roasScore = Math.min(40, Math.max(0, roas * 20)); // roas 2 = 40
  if (ratio < 0.5) reasons.push("Muitas campanhas pausadas");
  if (roas < 1) reasons.push("ROAS médio abaixo de 1×");
  const score = clamp(activityScore + roasScore);
  return { dimension: "campaign", score, severity: classify(score), reasons };
}

export function scoreBudget(camps: CampaignFacts[]): HealthComponent {
  const reasons: string[] = [];
  const totalSpend = camps.reduce((s, c) => s + c.spendCents, 0);
  const totalRev = camps.reduce((s, c) => s + c.revenueCents, 0);
  if (totalSpend === 0) {
    return { dimension: "budget", score: 50, severity: "attention", reasons: ["Sem investimento no período"] };
  }
  const efficiency = totalRev / totalSpend;
  const wasted = camps.filter((c) => c.spendCents > 0 && c.conversions === 0);
  if (wasted.length) reasons.push(`${wasted.length} campanha(s) sem conversões`);
  if (efficiency < 1) reasons.push("Investimento não paga o retorno");
  const score = clamp(Math.min(100, efficiency * 50) - wasted.length * 10);
  return { dimension: "budget", score, severity: classify(score), reasons };
}

export function scoreConversion(camps: CampaignFacts[]): HealthComponent {
  const reasons: string[] = [];
  const clicks = camps.reduce((s, c) => s + c.clicks, 0);
  const conv = camps.reduce((s, c) => s + c.conversions, 0);
  if (clicks === 0) return { dimension: "conversion", score: 0, severity: "critical", reasons: ["Sem cliques registrados"] };
  const rate = conv / clicks;
  if (rate < 0.01) reasons.push("Taxa de conversão < 1%");
  const score = clamp(rate * 2000); // 5% = 100
  return { dimension: "conversion", score, severity: classify(score), reasons };
}

export function scoreTracking(t: TrackingFacts | undefined): HealthComponent {
  if (!t) return { dimension: "tracking", score: 0, severity: "critical", reasons: ["Tracking não configurado"] };
  const reasons: string[] = [];
  let s = 0;
  s += t.coverage * 40;
  if (t.conversionsConfigured) s += 20; else reasons.push("Conversões não configuradas");
  if (t.ga4Linked) s += 15; else reasons.push("GA4 não vinculado");
  if (t.gtmPresent) s += 15; else reasons.push("GTM ausente");
  if (t.offlineConversions) s += 10;
  const score = clamp(s);
  return { dimension: "tracking", score, severity: classify(score), reasons };
}

export function scoreKeywords(camps: CampaignFacts[]): HealthComponent {
  const reasons: string[] = [];
  const impressions = camps.reduce((s, c) => s + c.impressions, 0);
  const clicks = camps.reduce((s, c) => s + c.clicks, 0);
  if (impressions === 0) return { dimension: "keyword", score: 0, severity: "critical", reasons: ["Sem impressões"] };
  const ctr = clicks / impressions;
  if (ctr < 0.01) reasons.push("CTR muito baixo");
  const score = clamp(ctr * 5000); // 2% = 100
  return { dimension: "keyword", score, severity: classify(score), reasons };
}

export function computeMarketingHealth(
  camps: CampaignFacts[] = [],
  tracking?: TrackingFacts,
): MarketingHealthReport {
  const components: HealthComponent[] = [
    scoreCampaigns(camps),
    scoreBudget(camps),
    scoreConversion(camps),
    scoreTracking(tracking),
    scoreKeywords(camps),
  ];
  const overall = clamp(components.reduce((s, c) => s + c.score, 0) / components.length);
  return { overall, severity: classify(overall), components, computedAt: new Date().toISOString() };
}
