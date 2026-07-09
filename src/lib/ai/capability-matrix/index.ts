// EPIC A — Zenno Brain · Capability Matrix
// Relates Provider × Model × Skill × Plan × Role × Rule. Planner MUST query
// this matrix before assembling any Workflow. Purely additive: it does not
// replace the Provider Layer or Registry — it composes on top of both.

import type { CapabilityRow, CapabilityQuery, CapabilityMatch } from "../contracts/capability";

export * from "../contracts/capability";

const PLAN_TIERS: Record<string, number> = {
  free: 0, starter: 1, pro: 2, enterprise: 3,
};

const ROLE_TIERS: Record<string, number> = {
  viewer: 0, analyst: 1, member: 1, admin: 2, owner: 3,
};

function tierAtLeast(tiers: Record<string, number>, actual: string, required: string): boolean {
  const a = tiers[actual] ?? 0;
  const r = tiers[required] ?? 0;
  return a >= r;
}

export class CapabilityMatrix {
  private rows: CapabilityRow[] = [];

  register(row: CapabilityRow): void { this.rows.push(row); }
  registerMany(rows: CapabilityRow[]): void { rows.forEach((r) => this.register(r)); }
  all(): CapabilityRow[] { return [...this.rows]; }
  clear(): void { this.rows = []; }

  match(query: CapabilityQuery): CapabilityMatch[] {
    const out: CapabilityMatch[] = [];
    for (const row of this.rows) {
      if (!row.active) continue;
      if (row.skill !== query.skill) continue;
      if (!row.supportsAgents.includes(query.agent)) continue;
      if (!tierAtLeast(PLAN_TIERS, query.plan, row.requiredPlan)) continue;
      if (!tierAtLeast(ROLE_TIERS, query.role, row.requiredRole)) continue;
      if (query.allowedProviders && !query.allowedProviders.includes(row.provider)) continue;

      // Deterministic scoring: cheaper + faster + higher-tier = higher score.
      const costScore = 1 - Math.min(1, row.costRankPerMTokCents / 5000);
      const latencyScore = 1 - Math.min(1, row.latencyRankMs / 5000);
      const score = Number((0.6 * costScore + 0.4 * latencyScore).toFixed(4));
      out.push({
        provider: row.provider,
        model: row.model,
        skill: row.skill,
        score,
        reason: `plan≥${row.requiredPlan}, role≥${row.requiredRole}`,
      });
    }
    return out.sort((a, b) => b.score - a.score);
  }
}

// Default matrix — mirrors registry defaults. Additive; adjust in a migration
// or via `registerMany` at boot when new skills/models arrive.
const DEFAULT_ROWS: CapabilityRow[] = [
  {
    provider: "anthropic", model: "claude-3-5-sonnet-latest", skill: "campaign_analysis",
    requiredPlan: "starter", requiredRole: "analyst", requiresRule: null,
    supportsAgents: ["campaign_analyst", "executive_advisor"],
    costRankPerMTokCents: 300, latencyRankMs: 800, active: true,
  },
  {
    provider: "openai", model: "gpt-5.5-mini", skill: "tracking_analysis",
    requiredPlan: "free", requiredRole: "viewer", requiresRule: null,
    supportsAgents: ["tracking_analyst"],
    costRankPerMTokCents: 30, latencyRankMs: 400, active: true,
  },
  {
    provider: "google", model: "gemini-2.5-pro", skill: "seo_analysis",
    requiredPlan: "starter", requiredRole: "analyst", requiresRule: null,
    supportsAgents: ["seo_analyst"],
    costRankPerMTokCents: 125, latencyRankMs: 900, active: true,
  },
  {
    provider: "anthropic", model: "claude-3-5-sonnet-latest", skill: "executive_summary",
    requiredPlan: "pro", requiredRole: "admin", requiresRule: null,
    supportsAgents: ["executive_advisor"],
    costRankPerMTokCents: 300, latencyRankMs: 1000, active: true,
  },
];

export const capabilityMatrix = new CapabilityMatrix();
capabilityMatrix.registerMany(DEFAULT_ROWS);
