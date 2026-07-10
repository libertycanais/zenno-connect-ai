// FEATURE — Marketing Intelligence · AI Readiness Score
import type { AIReadinessReport, TrackingFacts, CampaignFacts } from "../types";

function clamp(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

export function computeAIReadiness(
  camps: CampaignFacts[] = [],
  tracking?: TrackingFacts,
): AIReadinessReport {
  const hasCampaigns = camps.length > 0;
  const t = tracking;
  const components: AIReadinessReport["components"] = [
    {
      key: "google_ads",
      score: hasCampaigns ? 100 : 0,
      ready: hasCampaigns,
      gap: hasCampaigns ? undefined : "Nenhuma campanha detectada",
    },
    {
      key: "analytics",
      score: t?.ga4Linked ? 100 : 0,
      ready: !!t?.ga4Linked,
      gap: t?.ga4Linked ? undefined : "GA4 não vinculado",
    },
    {
      key: "search_console",
      score: t?.gscLinked ? 100 : 0,
      ready: !!t?.gscLinked,
      gap: t?.gscLinked ? undefined : "Search Console ausente",
    },
    {
      key: "tag_manager",
      score: t?.gtmPresent ? 100 : 0,
      ready: !!t?.gtmPresent,
      gap: t?.gtmPresent ? undefined : "GTM não detectado",
    },
    {
      key: "conversions",
      score: t?.conversionsConfigured ? 100 : 0,
      ready: !!t?.conversionsConfigured,
      gap: t?.conversionsConfigured ? undefined : "Conversões não configuradas",
    },
    {
      key: "offline_conversions",
      score: t?.offlineConversions ? 100 : 40,
      ready: !!t?.offlineConversions,
      gap: t?.offlineConversions ? undefined : "Sem conversões offline",
    },
  ];
  const overall = clamp(components.reduce((s, c) => s + c.score, 0) / components.length);
  return { overall, components, computedAt: new Date().toISOString() };
}
