// EPIC I — Executive Report Builder
import type {
  ExecutiveEngineInput, ExecutiveReport, ExecutivePriorityItem,
  ExecutiveRisk, ExecutiveOpportunity, ExecutiveNextAction, ExecutiveKpiSnapshot,
} from "./types";
import type { ConsensusResult } from "../consensus";
import { computeExecutiveScore, type ScoreInputs, type ScoreWeights } from "./score";
import { buildExecutiveNarrative } from "./narrative";

const genId = (p: string) => `${p}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

export type BuildReportOpts = {
  scoreInputs?: ScoreInputs;
  scoreWeights?: ScoreWeights;
  consensus?: ConsensusResult | null;
};

export function buildExecutiveReport(
  input: ExecutiveEngineInput,
  opts: BuildReportOpts = {},
): ExecutiveReport {
  const risks = deriveRisks(input);
  const opportunities = deriveOpportunities(input);
  const criticalKpis = pickCritical(input.kpis);
  const priorities = deriveExecutivePriorities(input, risks, opportunities, opts.consensus ?? null);
  const nextActions = deriveNextActions(priorities);
  const projections = input.horizonDays
    ? input.kpis.filter((k) => k.value !== null).slice(0, 5).map((k) => ({
        horizonDays: input.horizonDays!,
        metric: k.kpi,
        baseline: k.value,
        projected: k.value === null ? null : k.value * (1 + (k.delta ?? 0)),
        confidence: 0.4,
        method: "naive" as const,
      }))
    : [];
  const financialImpactCents =
    opportunities.reduce((s, o) => s + o.upsideCents, 0) +
    risks.reduce((s, r) => s + r.impactCents, 0);
  const score = computeExecutiveScore(opts.scoreInputs ?? {}, opts.scoreWeights);
  const confidence = clamp01(
    (opts.consensus?.confidence ?? 0.5) * 0.5 +
    (opportunities.length ? avg(opportunities.map((o) => o.confidence)) : 0.5) * 0.5,
  );
  const expertsInvolved = [...new Set(input.expertOutputs.map((e) => e.expertId))];
  const draft: Omit<ExecutiveReport, "narrative"> = {
    reportId: genId("execrep"),
    organizationId: input.organizationId,
    generatedAt: new Date().toISOString(),
    version: 1,
    summary: buildSummary(input, priorities, score.overall),
    situation: buildSituation(input, criticalKpis, risks),
    criticalKpis,
    risks,
    opportunities,
    financialImpactCents,
    priorities,
    linkedPlaybookIds: [...new Set(input.expertOutputs.flatMap((e) => e.playbooks.map((p) => (p as { playbookId?: string; id?: string }).playbookId ?? (p as { id?: string }).id ?? "")).filter(Boolean))],
    nextActions,
    projections,
    score,
    consensus: opts.consensus ?? null,
    confidence,
    explainability: {
      sources: input.memoryRefs ?? [],
      expertsInvolved,
      memoryRefs: input.memoryRefs ?? [],
      ruleRefs: input.ruleRefs ?? [],
      confidence,
    },
  };
  return { ...draft, narrative: buildExecutiveNarrative(draft) };
}

function pickCritical(kpis: ExecutiveKpiSnapshot[]): ExecutiveKpiSnapshot[] {
  return kpis
    .filter((k) => k.severity === "critical" || k.severity === "warn")
    .sort((a, b) => sevRank(b.severity) - sevRank(a.severity))
    .slice(0, 10);
}

function deriveRisks(input: ExecutiveEngineInput): ExecutiveRisk[] {
  const out: ExecutiveRisk[] = [];
  for (const s of input.signals ?? []) {
    if (s.severity === "info") continue;
    out.push({
      id: `risk_${s.id}`,
      title: s.title,
      severity: s.severity,
      likelihood: s.severity === "critical" ? 0.8 : 0.5,
      impactCents: s.impactCents ?? 0,
      category: "operational",
      evidence: [s.id],
    });
  }
  for (const k of input.kpis) {
    if (k.severity === "critical" && (k.delta ?? 0) < 0) {
      out.push({
        id: `risk_kpi_${k.kpi}`,
        title: `Queda crítica em ${k.label}`,
        severity: "critical",
        likelihood: 0.7,
        impactCents: 0,
        category: "financial",
        evidence: [k.kpi],
      });
    }
  }
  return out;
}

function deriveOpportunities(input: ExecutiveEngineInput): ExecutiveOpportunity[] {
  const out: ExecutiveOpportunity[] = [];
  for (const eo of input.expertOutputs) {
    for (const rec of eo.recommendations) {
      const r = rec as { recommendationId?: string; id?: string; title?: string; expectedImpactCents?: number; confidence?: number };
      const id = r.recommendationId ?? r.id;
      if (!id) continue;
      const upside = r.expectedImpactCents ?? 0;
      if (upside <= 0) continue;
      out.push({
        id: `opp_${id}`,
        title: r.title ?? `Recomendação ${id}`,
        upsideCents: upside,
        effort: "medium",
        confidence: clamp01(r.confidence ?? 0.5),
        evidence: [id],
      });
    }
  }
  return out.sort((a, b) => b.upsideCents * b.confidence - a.upsideCents * a.confidence);
}

function deriveExecutivePriorities(
  input: ExecutiveEngineInput,
  risks: ExecutiveRisk[],
  opps: ExecutiveOpportunity[],
  consensus: ConsensusResult | null,
): ExecutivePriorityItem[] {
  const consensusIds = new Set(consensus?.finalRecommendations ?? []);
  const items: ExecutivePriorityItem[] = [];
  for (const r of risks) {
    items.push({
      id: `prio_${r.id}`,
      title: `Mitigar: ${r.title}`,
      priority: r.severity === "critical" ? 1 : 2,
      rationale: `Risco ${r.severity} · likelihood=${r.likelihood.toFixed(2)}`,
      linkedRecommendationIds: [],
      linkedPlaybookIds: [],
      impactCents: r.impactCents,
      confidence: r.likelihood,
    });
  }
  for (const o of opps.slice(0, 5)) {
    const inConsensus = [...consensusIds].some((cid) => o.evidence.includes(cid));
    items.push({
      id: `prio_${o.id}`,
      title: `Executar: ${o.title}`,
      priority: inConsensus ? 1 : o.confidence > 0.6 ? 2 : 3,
      rationale: inConsensus ? "Aprovado por consenso multi-expert" : `Upside estimado ${o.upsideCents}c`,
      linkedRecommendationIds: o.evidence,
      linkedPlaybookIds: [],
      impactCents: o.upsideCents,
      confidence: o.confidence,
    });
  }
  void input;
  return items
    .sort((a, b) => a.priority - b.priority || Math.abs(b.impactCents) - Math.abs(a.impactCents))
    .slice(0, 10);
}

function deriveNextActions(prios: ExecutivePriorityItem[]): ExecutiveNextAction[] {
  return prios.slice(0, 5).map((p, i) => ({
    id: `act_${p.id}`,
    title: p.title,
    owner: "ops" as const,
    dueInDays: p.priority === 1 ? 3 : p.priority === 2 ? 7 : 14,
    effort: p.priority === 1 ? "high" : "medium",
    _order: i,
  })).map(({ _order, ...a }) => { void _order; return a; });
}

function buildSummary(input: ExecutiveEngineInput, prios: ExecutivePriorityItem[], score: number): string {
  const p1 = prios.filter((p) => p.priority === 1).length;
  return `Score ${score}/100 · ${prios.length} prioridades (${p1} P1) · Tópico=${input.topic}${input.dnaSummary ? ` · ${input.dnaSummary}` : ""}`;
}

function buildSituation(input: ExecutiveEngineInput, crit: ExecutiveKpiSnapshot[], risks: ExecutiveRisk[]): string {
  const critLine = crit.length ? `${crit.length} KPI(s) críticos/atenção` : "KPIs estáveis";
  const rLine = risks.length ? `${risks.length} risco(s) ativos` : "sem riscos ativos";
  return `${critLine}; ${rLine}; ${input.expertOutputs.length} expert(s) consultados.`;
}

function sevRank(s: "info" | "warn" | "critical"): number { return s === "critical" ? 2 : s === "warn" ? 1 : 0; }
function clamp01(n: number): number { return Math.max(0, Math.min(1, n)); }
function avg(a: number[]): number { return a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0; }
