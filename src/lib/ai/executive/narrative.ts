// EPIC I — Executive Narrative Builder (deterministic, no LLM)
import type { ExecutiveReport } from "./types";

export function buildExecutiveNarrative(r: Omit<ExecutiveReport, "narrative">): string {
  const parts: string[] = [];
  parts.push(`# Executive Brief\n`);
  parts.push(`**Situação:** ${r.situation}\n`);
  parts.push(`**Score Executivo:** ${r.score.overall}/100\n`);
  if (r.criticalKpis.length) {
    parts.push(`**KPIs Críticos:** ${r.criticalKpis.slice(0, 5).map((k) => `${k.label}=${fmt(k.value)}${k.unit}`).join(" · ")}\n`);
  }
  if (r.risks.length) {
    const top = r.risks.slice(0, 3).map((x) => `${x.title} (${x.severity})`).join("; ");
    parts.push(`**Riscos Principais:** ${top}\n`);
  }
  if (r.opportunities.length) {
    const top = r.opportunities.slice(0, 3).map((x) => `${x.title} (~${cents(x.upsideCents)})`).join("; ");
    parts.push(`**Oportunidades:** ${top}\n`);
  }
  parts.push(`**Impacto Financeiro Líquido:** ${cents(r.financialImpactCents)}\n`);
  if (r.priorities.length) {
    parts.push(`**Prioridades:**\n${r.priorities.slice(0, 5).map((p) => `- P${p.priority}: ${p.title}`).join("\n")}\n`);
  }
  if (r.nextActions.length) {
    parts.push(`**Próximas Ações:**\n${r.nextActions.slice(0, 5).map((a) => `- ${a.title} (owner=${a.owner}, ${a.dueInDays}d)`).join("\n")}\n`);
  }
  parts.push(`**Confiança:** ${(r.confidence * 100).toFixed(0)}%`);
  return parts.join("\n");
}

function fmt(v: number | null): string { return v === null ? "—" : String(v); }
function cents(c: number): string {
  const abs = Math.abs(c) / 100;
  const sign = c < 0 ? "-" : "";
  return `${sign}R$ ${abs.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
}
