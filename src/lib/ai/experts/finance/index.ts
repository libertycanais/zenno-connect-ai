// EPIC F — Finance Expert (additive).
// Análise de fluxo de caixa, burn rate, runway, margem, projeções.

import type { Expert, ExpertDescriptor, ExpertRunInput, ExpertRunOutput } from "../types";
import { buildEvidence } from "../../evidence";
import { buildRecommendation } from "../../recommendation";
import { buildPlaybook, validatePlaybook, type ChecklistItem, type ActionStep } from "../../playbooks";

const DESCRIPTOR: ExpertDescriptor = {
  id: "finance",
  displayName: "Finance Expert",
  domains: ["analytics", "benchmarks", "best-practices"],
  skills: ["cashflow_analysis", "burn_analysis", "runway_forecast", "margin_analysis", "financial_projection"],
  capabilities: ["insight", "diagnostic", "recommendation", "forecast"],
  businessRules: ["finance.runway_short", "finance.burn_high", "finance.margin_low"],
  promptTemplates: [{
    templateId: "finance.overview.v1",
    version: "1.0.0",
    systemPrompt: "Você é o Finance Expert do Zenno. Interprete indicadores financeiros. NUNCA calcule KPIs; use os fornecidos.",
    userPromptFingerprint: "finance.overview.v1.user",
  }],
  confidenceRules: { minSources: 2, minKpis: 1, minConfidence: 0.35 },
  active: true,
};

export class FinanceExpert implements Expert {
  readonly descriptor = DESCRIPTOR;

  run(input: ExpertRunInput): ExpertRunOutput {
    const evidence = buildEvidence({
      organizationId: input.organizationId,
      kpis: input.kpis,
      ruleIds: input.triggeredRules.map((r) => ({ id: r.id, domain: r.domain, version: r.version })),
      benchmarks: [],
      missing: [],
    });

    const built = input.triggeredRules.map((rule) => {
      const urgency: "critical" | "high" | "medium" = rule.severity === "critical" ? "critical" : rule.severity === "warn" ? "high" : "medium";
      const checklist: ChecklistItem[] = rule.recommend.map((r, i) => ({ id: `${rule.id}.chk.${i}`, title: humanize(r), done: false }));
      const actionPlan: ActionStep[] = rule.recommend.map((r, i) => ({
        id: `${rule.id}.step.${i}`,
        title: humanize(r),
        description: `Ação financeira: ${humanize(r)} (fonte: ${rule.id}).`,
        ownerRole: "finance_lead",
        dependsOn: i === 0 ? [] : [`${rule.id}.step.${i - 1}`],
        estimatedMinutes: 90,
        successCriterion: "Indicador financeiro retorna à faixa saudável.",
      }));
      const pb = buildPlaybook({
        organizationId: input.organizationId,
        title: rule.title,
        problem: rule.description,
        diagnosis: `${rule.title} identificado nos indicadores.`,
        evidence,
        impact: "Risco à sustentabilidade financeira do negócio.",
        urgency,
        complexity: "high",
        checklist,
        actionPlan,
        financialEstimate: { costCents: 0, savingsCents: 0, paybackDays: 60 },
        nextSteps: rule.recommend.map(humanize),
        successCriteria: [`${rule.id}.resolved`],
        expectedOutcome: "Restabelecer estabilidade financeira em 30 dias.",
      });
      if (!validatePlaybook(pb).ok) return null;
      return { rule, playbook: pb, urgency };
    }).filter((x): x is NonNullable<typeof x> => x !== null);

    const recs = built.map(({ rule, playbook, urgency }) =>
      buildRecommendation({
        organizationId: input.organizationId,
        summary: rule.title, diagnosis: rule.description, problem: rule.description,
        impact: "Impacto direto na saúde financeira.",
        financialValueCents: 0, urgency, complexity: "high",
        checklist: playbook.checklist.map((c) => ({ id: c.id, title: c.title, done: false })),
        playbookId: playbook.playbookId, playbook, evidence,
      }));

    return {
      expertId: DESCRIPTOR.id, evidence, recommendations: recs,
      playbooks: built.map((r) => r.playbook), generatedAt: new Date().toISOString(),
    };
  }
}

function humanize(id: string): string {
  return id.replace(/[_-]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export const financeExpert = new FinanceExpert();
