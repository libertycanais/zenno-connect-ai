// EPIC I — Executive Reporting formatters (deterministic)
import type { ExecutiveReport } from "../executive/types";

export function toMarkdown(r: ExecutiveReport): string {
  return [
    `# Executive Report`,
    `Org: ${r.organizationId} · Score: ${r.score.overall}/100 · ${r.generatedAt}`,
    ``,
    `## Resumo`, r.summary, ``,
    `## Situação`, r.situation, ``,
    `## KPIs Críticos`,
    ...r.criticalKpis.map((k) => `- ${k.label}: ${k.value ?? "—"}${k.unit} [${k.severity}]`),
    ``,
    `## Riscos`,
    ...r.risks.map((x) => `- [${x.severity}] ${x.title} (likelihood=${x.likelihood.toFixed(2)}, impact=${x.impactCents}c)`),
    ``,
    `## Oportunidades`,
    ...r.opportunities.map((x) => `- ${x.title} (upside=${x.upsideCents}c, conf=${x.confidence.toFixed(2)})`),
    ``,
    `## Prioridades`,
    ...r.priorities.map((p) => `- P${p.priority}: ${p.title} — ${p.rationale}`),
    ``,
    `## Próximas Ações`,
    ...r.nextActions.map((a) => `- ${a.title} (owner=${a.owner}, ${a.dueInDays}d)`),
    ``,
    `## Confiança: ${(r.confidence * 100).toFixed(0)}%`,
  ].join("\n");
}

export function toJson(r: ExecutiveReport): string {
  return JSON.stringify(r, null, 2);
}
