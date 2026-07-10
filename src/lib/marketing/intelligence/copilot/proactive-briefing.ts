// FEATURE — Marketing Intelligence Experience · Proactive Copilot briefing
// Pure function that turns a snapshot into a greeting the Copilot can open with.
import type { MarketingIntelligenceSnapshot } from "../snapshot/snapshot-store";

export type ProactiveBriefing = {
  headline: string;
  body: string;
  bullets: string[];
  cta: string;
  savingsCents: number;
};

function greeting(now = new Date()): string {
  const h = now.getHours();
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}

function money(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}

export function buildProactiveBriefing(snapshot: MarketingIntelligenceSnapshot | null): ProactiveBriefing {
  if (!snapshot) {
    return {
      headline: `${greeting()}.`,
      body: "Ainda não há dados sincronizados. Conecte sua conta Google para eu começar a analisar suas campanhas.",
      bullets: [],
      cta: "Conectar Google",
      savingsCents: 0,
    };
  }

  const savings = Math.round(snapshot.estimatedRoiCents * 0.15);
  const bullets: string[] = [];
  if (snapshot.opportunitiesCount > 0) bullets.push(`${snapshot.opportunitiesCount} oportunidades`);
  if (snapshot.risksCount > 0) bullets.push(`${snapshot.risksCount} risco${snapshot.risksCount > 1 ? "s" : ""}`);
  if (savings > 0) bullets.push(`potencial de economia de ${money(savings)}`);

  return {
    headline: `${greeting()}.`,
    body:
      snapshot.executiveSummary ||
      "Analisei suas campanhas durante a madrugada e consolidei o que precisa da sua atenção.",
    bullets,
    cta: "Deseja ver?",
    savingsCents: savings,
  };
}
