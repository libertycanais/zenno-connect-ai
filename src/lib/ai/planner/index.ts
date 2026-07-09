// EPIC A — Zenno Brain · Planner
// Assembles a deterministic Plan from a PlanRequest using: Business Context
// requirements, Capability Matrix, Skill Registry, and Business Rules report.
// The Planner NEVER calls a provider — it only produces structured Plan
// artifacts. Actual execution happens later in the Workflow layer.

import type { Plan, PlanRequest, PlanStep } from "../contracts/planner";
import type { RulesEngineReport } from "../contracts/rules";
import { capabilityMatrix } from "../capability-matrix";
import { skillRegistry, type SkillDescriptor } from "../skills";

export * from "../contracts/planner";

function nextPlanId(): string {
  return `plan_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

// Deterministic 16-hex fingerprint (djb2) over normalized plan shape.
function fingerprint(input: string): string {
  let h = 5381;
  for (let i = 0; i < input.length; i++) h = ((h << 5) + h + input.charCodeAt(i)) >>> 0;
  return h.toString(16).padStart(16, "0").slice(0, 16);
}

export type PlannerInput = {
  request: PlanRequest;
  rulesReport: RulesEngineReport;
  plan: string;               // billing plan slug (from ctx)
  role: string;               // RBAC role
};

export type PlannerResult = {
  ok: boolean;
  plan: Plan | null;
  reason: string;
  reasonCode: string;
};

function pickSkillsForKind(req: PlanRequest): SkillDescriptor[] {
  const all = skillRegistry.list();
  const byAgent: Record<string, string[]> = {
    campaign_analyst: ["campaign_analysis"],
    tracking_analyst: ["tracking_analysis"],
    seo_analyst: ["seo_analysis"],
    cro_analyst: ["cro_analysis"],
    executive_advisor: ["executive_summary", "forecast"],
    free_chat: [],
  };
  const wanted = byAgent[req.agent] ?? [];
  const pick = all.filter((s) => wanted.includes(s.id));
  if (pick.length > 0) return pick;
  // fallback: first skill compatible with a mainstream category
  return all.slice(0, 1);
}

function estimateStep(
  skill: SkillDescriptor,
  match: { provider: string; model: string } | null,
  index: number,
  costPerMTokCents = 200,
  latencyBaseMs = 800,
): PlanStep {
  const inTok = skill.estimatedInputTokens;
  const outTok = skill.estimatedOutputTokens;
  const costCents = Math.ceil(((inTok + outTok) / 1_000_000) * costPerMTokCents);
  const requiredCapabilities: PlanStep["requiredCapabilities"] = [];
  if (skill.needsReasoning) requiredCapabilities.push("reasoning");
  if (skill.needsVision) requiredCapabilities.push("vision");
  if (skill.needsTools) requiredCapabilities.push("tools");
  return {
    index,
    skillId: skill.id,
    provider: (match?.provider ?? null) as PlanStep["provider"],
    model: match?.model ?? null,
    priority: 5,
    dependsOn: index === 0 ? [] : [index - 1],
    estimatedInputTokens: inTok,
    estimatedOutputTokens: outTok,
    estimatedCostCents: costCents,
    estimatedLatencyMs: latencyBaseMs + Math.min(1200, outTok / 4),
    requiredCapabilities,
    producesArtifactKinds: ["analysis"],
  };
}

export class Planner {
  build(input: PlannerInput): PlannerResult {
    const { request, rulesReport, plan, role } = input;

    if (rulesReport.outcome === "block") {
      return {
        ok: false, plan: null,
        reason: rulesReport.blockingReasons.join("; ") || "Bloqueado por regras",
        reasonCode: "rules_blocked",
      };
    }

    const skills = pickSkillsForKind(request);
    if (skills.length === 0) {
      return { ok: false, plan: null, reason: "Nenhuma skill compatível", reasonCode: "no_skill" };
    }

    const steps: PlanStep[] = [];
    const reasonCodes: string[] = [];
    let idx = 0;
    for (const skill of skills) {
      const matches = capabilityMatrix.match({
        skill: skill.id,
        agent: request.agent,
        plan,
        role,
        requiredCapabilities: request.constraints.requiredCapabilities,
        allowedProviders: request.constraints.allowedProviders,
      });
      const top = matches[0]
        ? { provider: matches[0].provider, model: matches[0].model }
        : null;
      if (!top) reasonCodes.push(`no_capability_for:${skill.id}`);
      steps.push(estimateStep(skill, top, idx));
      idx += 1;
    }

    if (steps.length > request.constraints.maxSteps) {
      return { ok: false, plan: null, reason: "Excede maxSteps", reasonCode: "max_steps" };
    }

    const totalCost = steps.reduce((s, x) => s + x.estimatedCostCents, 0);
    if (totalCost > request.constraints.maxCostCents) {
      return { ok: false, plan: null, reason: "Excede maxCostCents", reasonCode: "cost_budget" };
    }

    const totalLatency = steps.reduce((s, x) => s + x.estimatedLatencyMs, 0);
    const totalTokens = steps.reduce((s, x) => s + x.estimatedInputTokens + x.estimatedOutputTokens, 0);

    const normalized = JSON.stringify({
      agent: request.agent, kind: request.kind,
      steps: steps.map((s) => [s.index, s.skillId, s.provider, s.model, s.dependsOn]),
    });

    const plainPlan: Plan = {
      planId: nextPlanId(),
      organizationId: request.organizationId,
      userId: request.userId,
      agent: request.agent,
      kind: request.kind,
      status: "draft",
      objective: request.objective,
      createdAt: new Date().toISOString(),
      steps,
      totalCostCents: totalCost,
      totalLatencyMs: totalLatency,
      totalTokens,
      fingerprint: fingerprint(normalized),
      featureFlags: request.featureFlags ?? [],
      reasonCodes,
    };
    return { ok: true, plan: plainPlan, reason: "planned", reasonCode: "ok" };
  }
}

export const planner = new Planner();
