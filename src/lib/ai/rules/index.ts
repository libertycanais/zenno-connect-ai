// EPIC A — Zenno Brain · Business Rules Engine
// Deterministic, explainable rule evaluation. Runs BEFORE the Planner. No
// workflow can be constructed unless the aggregate outcome is "allow" or
// "warn". Never accesses providers, DB, or secrets — pure functions only.

import type {
  BusinessRule, RuleContext, RuleEvaluation, RuleOutcome, RulesEngineReport,
} from "../contracts/rules";

export * from "../contracts/rules";

function fpBody(key: string, version: string): string {
  // Deterministic 16-hex fingerprint (djb2). Avoids crypto.subtle in unit
  // tests and keeps the rule identity stable across environments.
  let h = 5381;
  const body = `${key}@${version}`;
  for (let i = 0; i < body.length; i++) h = ((h << 5) + h + body.charCodeAt(i)) >>> 0;
  return h.toString(16).padStart(16, "0").slice(0, 16);
}

function evalPassing(rule: BusinessRule, reason: string, reasonCode: string): RuleEvaluation {
  return {
    ruleKey: rule.key, ruleVersion: rule.version, ruleFingerprint: rule.fingerprint,
    passed: true, outcome: "allow", severity: "info",
    reason, reasonCode, evaluatedAt: new Date().toISOString(),
  };
}
function evalFailing(
  rule: BusinessRule, outcome: Exclude<RuleOutcome, "allow">,
  reason: string, reasonCode: string,
): RuleEvaluation {
  return {
    ruleKey: rule.key, ruleVersion: rule.version, ruleFingerprint: rule.fingerprint,
    passed: false, outcome, severity: rule.severity,
    reason, reasonCode, evaluatedAt: new Date().toISOString(),
  };
}

// ── Default enterprise rules (additive; org-specific rules append) ──────────
const PLAN_ALLOWS_KIND: Record<string, string[]> = {
  free: ["chat", "analysis"],
  starter: ["chat", "analysis", "recommendation"],
  pro: ["chat", "analysis", "recommendation", "forecast", "workflow"],
  enterprise: ["chat", "analysis", "recommendation", "forecast", "workflow"],
};

function makeRule(
  key: string, version: string, severity: BusinessRule["severity"],
  description: string,
  evaluate: (ctx: RuleContext, self: BusinessRule) => RuleEvaluation,
): BusinessRule {
  const rule: BusinessRule = {
    key, version, fingerprint: fpBody(key, version), severity, description,
    evaluate: (ctx) => evaluate(ctx, rule),
  };
  return rule;
}

export const DEFAULT_RULES: BusinessRule[] = [
  makeRule("plan.kind_supported", "1.0.0", "block",
    "Kind of plan requested must be included in billing plan",
    (ctx, self) => {
      const allowed = PLAN_ALLOWS_KIND[ctx.plan] ?? [];
      if (!allowed.includes(ctx.request.kind)) {
        return evalFailing(self, "block",
          `Plano '${ctx.plan}' não permite kind='${ctx.request.kind}'`, "plan_kind_forbidden");
      }
      return evalPassing(self, "kind permitido", "ok");
    }),
  makeRule("budget.max_cost", "1.0.0", "block",
    "Custo estimado deve caber no budget restante",
    (ctx, self) => {
      if (ctx.request.constraints.maxCostCents > ctx.budgetRemainingCents) {
        return evalFailing(self, "block",
          `Budget insuficiente (${ctx.budgetRemainingCents} cents)`, "budget_exceeded");
      }
      return evalPassing(self, "budget suficiente", "ok");
    }),
  makeRule("rbac.role_required", "1.0.0", "block",
    "Role RBAC mínimo para acionar o agente",
    (ctx, self) => {
      const roleTiers: Record<string, number> = { viewer: 0, analyst: 1, member: 1, admin: 2, owner: 3 };
      const need = ctx.request.priority === "critical" ? 2 : 1;
      if ((roleTiers[ctx.role] ?? 0) < need) {
        return evalFailing(self, "block",
          `Role '${ctx.role}' insuficiente para prioridade '${ctx.request.priority}'`,
          "role_insufficient");
      }
      return evalPassing(self, "role compatível", "ok");
    }),
  makeRule("flags.planner_required", "1.0.0", "block",
    "Planner deve estar habilitado por feature flag",
    (ctx, self) => {
      if (!ctx.featureFlags.includes("enablePlanner")) {
        return evalFailing(self, "block", "Feature flag 'enablePlanner' desativada", "flag_disabled");
      }
      return evalPassing(self, "flag ativa", "ok");
    }),
  makeRule("constraints.max_steps", "1.0.0", "warn",
    "Muitos passos podem violar SLO de latência",
    (ctx, self) => {
      if (ctx.request.constraints.maxSteps > 25) {
        return evalFailing(self, "warn",
          `maxSteps=${ctx.request.constraints.maxSteps} acima do SLO recomendado (25)`,
          "steps_over_slo");
      }
      return evalPassing(self, "dentro do SLO", "ok");
    }),
];

export class BusinessRulesEngine {
  private rules: BusinessRule[] = [];
  constructor(initial: BusinessRule[] = DEFAULT_RULES) { this.rules = [...initial]; }
  register(rule: BusinessRule): void { this.rules.push(rule); }
  list(): BusinessRule[] { return [...this.rules]; }
  clear(): void { this.rules = []; }

  async evaluate(ctx: RuleContext): Promise<RulesEngineReport> {
    const evaluations: RuleEvaluation[] = [];
    let outcome: RuleOutcome = "allow";
    const blockingReasons: string[] = [];

    for (const r of this.rules) {
      const ev = await r.evaluate(ctx);
      evaluations.push(ev);
      if (ev.outcome === "block") {
        outcome = "block";
        blockingReasons.push(ev.reason);
      } else if (ev.outcome === "warn" && outcome !== "block") {
        outcome = "warn";
      }
    }
    return {
      organizationId: ctx.organizationId,
      evaluations,
      outcome,
      blockingReasons,
      evaluatedAt: new Date().toISOString(),
    };
  }
}

export const businessRules = new BusinessRulesEngine();
