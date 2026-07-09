// EPIC F — Sales Expert (additive).
// Diagnóstico de funil, priorização de leads, previsão de conversão.
// Reutiliza Evidence / Playbook / Recommendation engines.

import type { Expert, ExpertDescriptor, ExpertRunInput, ExpertRunOutput } from "../types";
import { buildEvidence } from "../../evidence";
import { buildRecommendation } from "../../recommendation";
import { buildPlaybook, validatePlaybook, type ChecklistItem, type ActionStep } from "../../playbooks";

const DESCRIPTOR: ExpertDescriptor = {
  id: "sales",
  displayName: "Sales Expert",
  domains: ["crm", "analytics", "benchmarks", "best-practices"],
  skills: ["pipeline_analysis", "lead_scoring", "conversion_forecast", "deal_prioritization"],
  capabilities: ["insight", "diagnostic", "recommendation", "forecast"],
  businessRules: ["sales.pipeline_stalled", "sales.low_conversion", "sales.lead_quality_drop"],
  promptTemplates: [{
    templateId: "sales.overview.v1",
    version: "1.0.0",
    systemPrompt: "Você é o Sales Expert do Zenno. Interprete o funil comercial. NUNCA calcule KPIs; use os fornecidos.",
    userPromptFingerprint: "sales.overview.v1.user",
  }],
  confidenceRules: { minSources: 2, minKpis: 1, minConfidence: 0.35 },
  active: true,
};

export class SalesExpert implements Expert {
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
        description: `Ação comercial: ${humanize(r)} (fonte: ${rule.id}).`,
        ownerRole: "sales_lead",
        dependsOn: i === 0 ? [] : [`${rule.id}.step.${i - 1}`],
        estimatedMinutes: 45,
        successCriterion: "Conversão do estágio aumenta em 14 dias.",
      }));
      const pb = buildPlaybook({
        organizationId: input.organizationId,
        title: rule.title,
        problem: rule.description,
        diagnosis: `${rule.title} identificado no funil.`,
        evidence,
        impact: "Perda de oportunidades no pipeline.",
        urgency,
        complexity: "medium",
        checklist,
        actionPlan,
        financialEstimate: { costCents: 0, savingsCents: 0, paybackDays: 30 },
        nextSteps: rule.recommend.map(humanize),
        successCriteria: [`${rule.id}.resolved`],
        expectedOutcome: "Restabelecer taxa de conversão em 14 dias.",
      });
      if (!validatePlaybook(pb).ok) return null;
      return { rule, playbook: pb, urgency };
    }).filter((x): x is NonNullable<typeof x> => x !== null);

    const recs = built.map(({ rule, playbook, urgency }) =>
      buildRecommendation({
        organizationId: input.organizationId,
        summary: rule.title, diagnosis: rule.description, problem: rule.description,
        impact: "Impacto direto na receita comercial.",
        financialValueCents: 0, urgency, complexity: "medium",
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

export const salesExpert = new SalesExpert();
