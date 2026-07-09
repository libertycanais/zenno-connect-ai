// EPIC A — Zenno Brain · Feature Flags engine
import type {
  FeatureFlagKey, FeatureFlagContext, FeatureFlagRule, FeatureFlagSnapshot,
} from "../contracts/feature-flags";

export * from "../contracts/feature-flags";

const DEFAULT_RULES: FeatureFlagRule[] = [
  { key: "enablePlanner", enabled: true },
  { key: "enableRecommendation", enabled: true },
  { key: "enableWorkflow", enabled: true },
  { key: "enableStreaming", enabled: true },
  { key: "enableConsensus", enabled: true, environments: ["development", "staging"] },
  { key: "enableArtifacts", enabled: true },
  { key: "enableForecast", enabled: true, plans: ["starter", "pro", "enterprise"] },
  { key: "enableReasoning", enabled: true, plans: ["pro", "enterprise"] },
  { key: "enableClaudeAnalysis", enabled: false }, // wiring later
];

export class FeatureFlagRegistry {
  private rules = new Map<FeatureFlagKey, FeatureFlagRule>();

  constructor(initial: FeatureFlagRule[] = DEFAULT_RULES) {
    for (const r of initial) this.rules.set(r.key, r);
  }

  upsert(rule: FeatureFlagRule): void {
    this.rules.set(rule.key, rule);
  }

  get(key: FeatureFlagKey): FeatureFlagRule | undefined {
    return this.rules.get(key);
  }

  list(): FeatureFlagRule[] {
    return [...this.rules.values()];
  }

  isEnabled(key: FeatureFlagKey, ctx: FeatureFlagContext): { enabled: boolean; reason: string } {
    const r = this.rules.get(key);
    if (!r) return { enabled: false, reason: "unknown_flag" };
    if (!r.enabled) return { enabled: false, reason: "flag_disabled" };
    if (r.environments && !r.environments.includes(ctx.environment)) {
      return { enabled: false, reason: `env_not_allowed:${ctx.environment}` };
    }
    if (r.organizations && !r.organizations.includes(ctx.organizationId)) {
      return { enabled: false, reason: "organization_not_in_allowlist" };
    }
    if (r.plans && !r.plans.includes(ctx.plan)) {
      return { enabled: false, reason: `plan_not_allowed:${ctx.plan}` };
    }
    if (r.users && !r.users.includes(ctx.userId)) {
      return { enabled: false, reason: "user_not_in_allowlist" };
    }
    if (r.agents && ctx.agent && !r.agents.includes(ctx.agent)) {
      return { enabled: false, reason: `agent_not_allowed:${ctx.agent}` };
    }
    return { enabled: true, reason: "ok" };
  }

  snapshot(ctx: FeatureFlagContext): FeatureFlagSnapshot {
    const active: FeatureFlagKey[] = [];
    const denied: FeatureFlagSnapshot["denied"] = [];
    for (const r of this.rules.values()) {
      const res = this.isEnabled(r.key, ctx);
      if (res.enabled) active.push(r.key);
      else denied.push({ key: r.key, reason: res.reason });
    }
    return { takenAt: new Date().toISOString(), context: ctx, active, denied };
  }
}

export const featureFlags = new FeatureFlagRegistry();
