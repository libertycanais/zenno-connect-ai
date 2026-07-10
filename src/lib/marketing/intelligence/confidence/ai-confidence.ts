// FEATURE — First Five Minutes · AI Confidence indicator (additive)
// Fourth pillar next to Health / Readiness / Executive Score.
// Answers: "how much should the user trust this analysis?"
// Pure function; no external state. Never returns >100 or <0.
import type { PipelineResult, CampaignFacts } from "../types";

export type AIConfidenceBasis = {
  campaigns: number;
  conversions: number;
  historyMonths: number;
  trackingCoverage: number; // 0..1
};

export type AIConfidenceResult = {
  score: number;                   // 0..100
  level: "Very High" | "High" | "Moderate" | "Low";
  basis: AIConfidenceBasis;
  rationale: string;               // short human explanation ("Baseado em X campanhas, Y conversões…")
};

const MIN_CAMPAIGNS_FULL = 20;
const MIN_CONVERSIONS_FULL = 500;
const MIN_HISTORY_FULL = 3;

function level(score: number): AIConfidenceResult["level"] {
  if (score >= 90) return "Very High";
  if (score >= 75) return "High";
  if (score >= 55) return "Moderate";
  return "Low";
}

function ratio(value: number, target: number): number {
  if (target <= 0) return 1;
  return Math.min(1, value / target);
}

export type AIConfidenceInput = {
  campaigns?: CampaignFacts[];
  historyMonths?: number;
  trackingCoverage?: number;
};

export function computeAIConfidence(input: AIConfidenceInput): AIConfidenceResult {
  const campaigns = input.campaigns ?? [];
  const conversions = campaigns.reduce((n, c) => n + (c.conversions ?? 0), 0);
  const historyMonths = Math.max(0, input.historyMonths ?? 0);
  const trackingCoverage = Math.max(0, Math.min(1, input.trackingCoverage ?? 0));

  const campaignsScore = ratio(campaigns.length, MIN_CAMPAIGNS_FULL) * 25;
  const conversionsScore = ratio(conversions, MIN_CONVERSIONS_FULL) * 35;
  const historyScore = ratio(historyMonths, MIN_HISTORY_FULL) * 25;
  const trackingScore = trackingCoverage * 15;

  const raw = campaignsScore + conversionsScore + historyScore + trackingScore;
  const score = Math.round(Math.max(0, Math.min(100, raw)));

  const basis: AIConfidenceBasis = {
    campaigns: campaigns.length,
    conversions,
    historyMonths,
    trackingCoverage,
  };

  const parts: string[] = [];
  if (basis.campaigns > 0) parts.push(`${basis.campaigns} campanha${basis.campaigns === 1 ? "" : "s"}`);
  if (basis.conversions > 0) parts.push(`${basis.conversions.toLocaleString("pt-BR")} conversões`);
  if (basis.historyMonths > 0) parts.push(`${basis.historyMonths} ${basis.historyMonths === 1 ? "mês" : "meses"} de histórico`);

  const rationale = parts.length > 0
    ? `Baseado em ${parts.join(" · ")}.`
    : "Ainda sem dados suficientes para uma análise confiável.";

  return { score, level: level(score), basis, rationale };
}

export function computeAIConfidenceFromPipeline(
  result: PipelineResult,
  input: { campaigns?: CampaignFacts[]; historyMonths?: number; trackingCoverage?: number },
): AIConfidenceResult {
  return computeAIConfidence({
    campaigns: input.campaigns,
    historyMonths: input.historyMonths,
    trackingCoverage: input.trackingCoverage ?? result.aiReadiness.overall / 100,
  });
}
