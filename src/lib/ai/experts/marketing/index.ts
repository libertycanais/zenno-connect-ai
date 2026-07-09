// Marketing Expert · Primeiro Expert oficial.
// Responsável por Meta Ads, Google Ads, Tracking, Conversão, Funil, ROI, ROAS,
// CAC, criativos, públicos, campanhas, orçamento, landing pages.
//
// FLUXO: Knowledge → Business KPIs → Context → Claude → Recommendation → Playbook
// Este módulo apenas orquestra a interpretação; Claude é acessado via
// ExecutionEngine + AI Runtime + Provider Layer (nunca direto).

import type {
  Expert, ExpertDescriptor, ExpertRunInput, ExpertRunOutput,
} from "../types";
import { buildEvidence } from "../../evidence";
import { buildRecommendation } from "../../recommendation";
import { buildPlaybook, validatePlaybook, type ChecklistItem, type ActionStep } from "../../playbooks";
import { compare, type BenchmarkKey } from "@/lib/business/benchmarks";

const DESCRIPTOR: ExpertDescriptor = {
  id: "marketing",
  displayName: "Marketing Expert",
  domains: ["meta-ads", "google-ads", "tracking", "cro", "analytics", "benchmarks", "meta-policies", "google-policies", "lgpd", "best-practices"],
  skills: [
    "campaign_analysis", "creative_analysis", "audience_analysis",
    "budget_optimization", "tracking_diagnostic", "funnel_diagnostic",
    "landing_page_review",
  ],
  capabilities: ["insight", "diagnostic", "recommendation", "benchmark"],
  businessRules: [
    "meta.ctr_below_p25", "meta.roas_below_1", "meta.pixel_missing",
    "gads.quality_score_low", "gads.conversion_tracking_missing",
    "tracking.coverage_low",
  ],
  promptTemplates: [{
    templateId: "marketing.overview.v1",
    version: "1.0.0",
    systemPrompt: "Você é o Marketing Expert do Zenno. Interprete KPIs e regras. NUNCA calcule KPIs; use apenas os valores fornecidos.",
    userPromptFingerprint: "marketing.overview.v1.user",
  }],
  confidenceRules: { minSources: 3, minKpis: 2, minConfidence: 0.35 },
  active: true,
};

export class MarketingExpert implements Expert {
  readonly descriptor = DESCRIPTOR;

  run(input: ExpertRunInput): ExpertRunOutput {
    const evidence = buildEvidence({
      organizationId: input.organizationId,
      kpis: input.kpis,
      ruleIds: input.triggeredRules.map((r) => ({ id: r.id, domain: r.domain, version: r.version })),
      benchmarks: this.benchmarksFromKpis(input.kpis),
      missing: this.detectMissing(input),
    });

    const recommendations = input.triggeredRules.map((rule) => {
      const urgency = rule.severity === "critical" ? "critical" : rule.severity === "warn" ? "high" : "medium";
      const checklist: ChecklistItem[] = rule.recommend.map((r, i) => ({
        id: `${rule.id}.chk.${i}`, title: humanize(r), done: false,
      }));
      const actionPlan: ActionStep[] = rule.recommend.map((r, i) => ({
        id: `${rule.id}.step.${i}`,
        title: humanize(r),
        description: `Executar ação recomendada: ${humanize(r)} (fonte: ${rule.id}).`,
        ownerRole: "marketing_lead",
        dependsOn: i === 0 ? [] : [`${rule.id}.step.${i - 1}`],
        estimatedMinutes: 60,
        successCriterion: "KPI relacionado retorna para faixa 'ok' em 14 dias.",
      }));
      const pb = buildPlaybook({
        organizationId: input.organizationId,
        title: rule.title,
        problem: rule.description,
        diagnosis: `${rule.title} identificado em ${rule.domain}.`,
        evidence,
        impact: "Redução de eficiência de mídia e desperdício de orçamento.",
        urgency: urgency as "critical" | "high" | "medium",
        complexity: "medium",
        checklist,
        actionPlan,
        financialEstimate: { costCents: 0, savingsCents: 0, paybackDays: 30 },
        nextSteps: rule.recommend.map(humanize),
        successCriteria: [`${rule.id}.resolved`],
        expectedOutcome: "Restabelecer performance da campanha dentro de 14 dias.",
      });
      const val = validatePlaybook(pb);
      if (!val.ok) {
        // Never surface an invalid playbook — Evidence Engine barrier.
        return null;
      }
      return { rule, playbook: pb, urgency };
    }).filter((x): x is NonNullable<typeof x> => x !== null);

    const builtRecs = recommendations.map(({ rule, playbook, urgency }) =>
      buildRecommendation({
        organizationId: input.organizationId,
        summary: rule.title,
        diagnosis: rule.description,
        problem: rule.description,
        impact: "Impacto direto na performance de campanhas.",
        financialValueCents: 0,
        urgency,
        complexity: "medium",
        checklist: playbook.checklist.map((c) => ({ id: c.id, title: c.title, done: false })),
        playbookId: playbook.playbookId,
        playbook,
        evidence,
      }),
    );

    return {
      expertId: DESCRIPTOR.id,
      evidence,
      recommendations: builtRecs,
      playbooks: recommendations.map((r) => r.playbook),
      generatedAt: new Date().toISOString(),
    };
  }

  private benchmarksFromKpis(kpis: ExpertRunInput["kpis"]): Array<{ key: string; percentile: number }> {
    const out: Array<{ key: string; percentile: number }> = [];
    for (const k of kpis) {
      if (k.value === null) continue;
      const key = mapKpiToBenchmark(k.kpi);
      if (!key) continue;
      const c = compare(key, k.value);
      out.push({ key: c.key, percentile: c.percentileEstimate });
    }
    return out;
  }

  private detectMissing(input: ExpertRunInput): Array<{ code: string; description: string }> {
    const missing: Array<{ code: string; description: string }> = [];
    const kpiIds = new Set(input.kpis.map((k) => k.kpi));
    for (const need of ["roas", "cac", "ctr"]) {
      if (!kpiIds.has(need)) missing.push({ code: `KPI_MISSING:${need}`, description: `KPI ${need} não fornecido` });
    }
    return missing;
  }
}

function humanize(id: string): string {
  return id.replace(/[_-]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function mapKpiToBenchmark(kpi: string): BenchmarkKey | null {
  switch (kpi) {
    case "ctr":  return "meta.ctr";
    case "cpc":  return "meta.cpc_cents";
    case "cpm":  return "meta.cpm_cents";
    case "roas": return "meta.roas";
    default:     return null;
  }
}

export const marketingExpert = new MarketingExpert();
