// EPIC B — AI Execution Platform · Skill Router (complete)
// Given a WorkflowStep + FeatureFlagContext + RBAC + Plan, selects the best
// (provider, model) pair from the CapabilityMatrix + Registry + Health. Never
// calls providers directly.

import type { AIProviderName, AIAgent } from "../types";
import type { WorkflowStep } from "../contracts/workflow";
import type { CapabilityMatch } from "../contracts/capability";
import { capabilityMatrix } from "../capability-matrix";
import { providerHealth } from "../health";
import { skillRegistry } from "../skills";

export type SkillRoute = {
  provider: AIProviderName;
  model: string;
  score: number;
  reason: string;
  fallbacks: CapabilityMatch[];
};

export type SkillRouterInput = {
  step: WorkflowStep;
  agent: AIAgent;
  plan: string;
  role: string;
  allowedProviders?: AIProviderName[];
};

export class SkillRouter {
  route(input: SkillRouterInput): SkillRoute | null {
    const { step, agent, plan, role } = input;
    const matches = capabilityMatrix.match({
      skill: step.skill, agent, plan, role,
      requiredCapabilities: step.requiredCapabilities,
      allowedProviders: input.allowedProviders,
    });
    if (matches.length === 0) return null;

    // Filter out providers whose circuit is currently degraded/offline.
    const healthy = matches.filter((m) => {
      const snap = providerHealth.snapshot(m.provider);
      return snap.status !== "offline";
    });
    const ordered = healthy.length > 0 ? healthy : matches;
    const [best, ...fallbacks] = ordered;
    return { provider: best.provider, model: best.model, score: best.score,
             reason: best.reason, fallbacks };
  }

  describe(skillId: string) { return skillRegistry.get(skillId); }
}

export const skillRouter = new SkillRouter();
