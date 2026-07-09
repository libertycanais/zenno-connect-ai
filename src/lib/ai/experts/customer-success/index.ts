// EPIC F — Customer Success Expert (additive).
// Retenção, churn, health score, expansão, risco de cancelamento.

import type { Expert, ExpertDescriptor, ExpertRunInput, ExpertRunOutput } from "../types";
import { buildEvidence } from "../../evidence";
import { buildRecommendation } from "../../recommendation";
import { buildPlaybook, validatePlaybook, type ChecklistItem, type ActionStep } from "../../playbooks";

const DESCRIPTOR: ExpertDescriptor = {
  id: "customer-success",
  displayName: "Customer Success Expert",
  domains: ["crm", "analytics", "benchmarks", "best-practices"],
  skills: ["retention_analysis", "churn_forecast", "health_score", "expansion_opportunity", "risk_scoring"],
  capabilities: ["insight", "diagnostic", "recommendation", "forecast"],
  businessRules: ["cs.churn_risk_high", "cs.health_low", "cs.expansion_opportunity"],
  promptTemplates: [{
    templateId: "cs.overview.v1",
    version: "1.0.0",
    systemPrompt: "Você é o Customer Success Expert do Zenno. Interprete indicadores de retenção. NUNCA calcule KPIs; use os fornecidos.",
    userPromptFingerprint: "cs.overview.v1.user",
  }],
  confidenceRules: { minSources: 2, minKpis: 1, minConfidence: 0.35 },
  active: true,
};

export class CustomerSuccessExpert implements Expert {
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
        description: `Ação de CS: ${humanize(r)} (fonte: ${rule.id}).`,
        ownerRole: "cs_lead",
        dependsOn: i === 0 ? [] : [`${rule.id}.step.${i - 1}`],
        estimatedMinutes: 30,
        successCriterion: "Health score da conta melhora em 14 dias.",
      }));
      const pb = buildPlaybook({
        organizationId: input.organizationId,
        title: rule.title,
        problem: rule.description,
        diagnosis: `${rule.title} identificado no portfólio de clientes.`,
        evidence,
        impact: "Risco de churn e perda de receita recorrente.",
        urgency,
        complexity: "medium",
        checklist,
        actionPlan,
        financialEstimate: { costCents: 0, savingsCents: 0, paybackDays: 30 },
        nextSteps: rule.recommend.map(humanize),
        successCriteria: [`${rule.id}.resolved`],
        expectedOutcome: "Reduzir risco de churn em 14 dias.",
      });
      if (!validatePlaybook(pb).ok) return null;
      return { rule, playbook: pb, urgency };
    }).filter((x): x is NonNullable<typeof x> => x !== null);

    const recs = built.map(({ rule, playbook, urgency }) =>
      buildRecommendation({
        organizationId: input.organizationId,
        summary: rule.title, diagnosis: rule.description, problem: rule.description,
        impact: "Impacto direto na retenção.",
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

export const customerSuccessExpert = new CustomerSuccessExpert();
