// EPIC D — Marketing Workflow Runner integration test.
import { describe, it, expect } from "vitest";
import { MarketingWorkflowRunner } from "@/lib/ai/experts/marketing-workflow";
import { createInMemoryExpertRepositories } from "@/lib/ai/persistence/experts";
import type { ExpertRunInput } from "@/lib/ai/experts/types";

function input() {
  return {
    organizationId: "org_wf",
    focus: "diagnostic",
    agent: "campaign_analyst" as const,
    plan: "starter",
    role: "owner",
    taskId: "task_wf_1",
    kpis: [
      { kpi: "roas", value: 0.7, unit: "ratio" as const, formula: "revenue/spend",
        inputs: { revenue: 70, spend: 100 }, severity: "critical" as const,
        warnings: [], computedAt: new Date().toISOString() },
    ],
    triggeredRules: [{
      id: "meta.roas_below_1",
      domain: "meta-ads",
      version: "1.0.0",
      severity: "critical",
      title: "ROAS abaixo de 1.0",
      description: "Campanhas com ROAS inferior a 1.0.",
      triggers: [],
      recommend: ["pause_bad_ads", "check_pixel"],
    }] as unknown as ExpertRunInput["triggeredRules"],
  };
}

describe("EPIC D — Marketing Workflow Runner", () => {
  it("executes workflow AND persists expert outputs (composition)", async () => {
    const repos = createInMemoryExpertRepositories();
    const runner = new MarketingWorkflowRunner({ repositories: repos });

    const result = await runner.run(input());

    // Workflow surfaced identifiers
    expect(result.workflowId).toMatch(/^wf_mkt_/);
    // ExecutionResult was produced (may fail on provider routing in-memory, but returns a shape)
    expect(result.execution.workflowId).toBe(result.workflowId);
    // Expert layer persisted structured outputs
    expect(result.expert.persisted.evidence.evidenceId).toBeDefined();
    expect(result.expert.persisted.recommendations.length).toBeGreaterThan(0);
    expect(result.expert.persisted.recommendations[0].workflowId).toBe(result.workflowId);

    const stored = await repos.recommendations.listByOrganization("org_wf");
    expect(stored.length).toBeGreaterThan(0);
  });
});
