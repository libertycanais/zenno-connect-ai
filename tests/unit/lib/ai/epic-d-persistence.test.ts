// EPIC D — In-memory expert repositories tests.
import { describe, it, expect } from "vitest";
import { createInMemoryExpertRepositories } from "@/lib/ai/persistence/experts";
import { ExpertService } from "@/lib/ai/experts/service";
import { MarketingExpert } from "@/lib/ai/experts/marketing";
import type { ExpertRunInput } from "@/lib/ai/experts/types";

const ORG_A = "org_A";
const ORG_B = "org_B";

function baseInput(orgId: string): ExpertRunInput {
  return {
    organizationId: orgId,
    focus: "diagnostic",
    kpis: [
      { kpi: "roas", value: 0.8, unit: "ratio", formula: "revenue/spend",
        inputs: { revenue: 100, spend: 125 }, severity: "critical",
        warnings: [], computedAt: new Date().toISOString() },
      { kpi: "ctr", value: 0.005, unit: "ratio", formula: "clicks/impressions",
        inputs: { clicks: 10, impressions: 2000 }, severity: "warn",
        warnings: [], computedAt: new Date().toISOString() },
    ],
    triggeredRules: [{
      id: "meta.roas_below_1",
      domain: "meta-ads",
      version: "1.0.0",
      severity: "critical",
      title: "ROAS abaixo de 1.0",
      description: "ROAS crítico — campanha destruindo caixa.",
      triggers: [],
      recommend: ["pause_worst_ad_sets", "recheck_pixel", "revisit_audiences"],
    }] as unknown as ExpertRunInput["triggeredRules"],
  };
}

describe("EPIC D — Expert persistence (in-memory)", () => {
  it("persists Evidence, Playbook and Recommendation via ExpertService", async () => {
    const repos = createInMemoryExpertRepositories();
    const svc = new ExpertService(new MarketingExpert(), repos);

    const { output, persisted } = await svc.runAndPersist(baseInput(ORG_A), {
      workflowId: "wf_test_1", taskId: "task_test_1",
    });

    expect(output.recommendations.length).toBeGreaterThan(0);
    expect(persisted.evidence.evidenceId).toBe(output.evidence.evidenceId);
    expect(persisted.playbooks.length).toBe(output.playbooks.length);
    expect(persisted.recommendations.every((r) => r.status === "open")).toBe(true);
    expect(persisted.recommendations.every((r) => r.workflowId === "wf_test_1")).toBe(true);

    const list = await repos.recommendations.listByOrganization(ORG_A);
    expect(list.length).toBe(persisted.recommendations.length);
  });

  it("isolates recommendations per organization (multi-tenant)", async () => {
    const repos = createInMemoryExpertRepositories();
    const svc = new ExpertService(new MarketingExpert(), repos);
    await svc.runAndPersist(baseInput(ORG_A));
    await svc.runAndPersist(baseInput(ORG_B));

    const a = await repos.recommendations.listByOrganization(ORG_A);
    const b = await repos.recommendations.listByOrganization(ORG_B);
    expect(a.length).toBeGreaterThan(0);
    expect(b.length).toBeGreaterThan(0);
    expect(a.every((r) => r.organizationId === ORG_A)).toBe(true);
    expect(b.every((r) => r.organizationId === ORG_B)).toBe(true);
  });

  it("updates recommendation status and filters by status", async () => {
    const repos = createInMemoryExpertRepositories();
    const svc = new ExpertService(new MarketingExpert(), repos);
    const { persisted } = await svc.runAndPersist(baseInput(ORG_A));
    const rec = persisted.recommendations[0];

    await repos.recommendations.updateStatus(ORG_A, rec.recommendationId, "resolved");
    const stored = await repos.recommendations.get(ORG_A, rec.recommendationId);
    expect(stored?.status).toBe("resolved");

    const open = await repos.recommendations.listByOrganization(ORG_A, { status: "open" });
    const resolved = await repos.recommendations.listByOrganization(ORG_A, { status: "resolved" });
    expect(open.every((r) => r.status === "open")).toBe(true);
    expect(resolved.some((r) => r.recommendationId === rec.recommendationId)).toBe(true);
  });

  it("upsert on save() is idempotent by (organization_id, recommendation_id)", async () => {
    const repos = createInMemoryExpertRepositories();
    const svc = new ExpertService(new MarketingExpert(), repos);
    const first = await svc.runAndPersist(baseInput(ORG_A));
    // Persist the same recommendation object again (same id) → should overwrite, not duplicate.
    await repos.recommendations.save({ ...first.persisted.recommendations[0], summary: "updated" });
    const stored = await repos.recommendations.get(ORG_A, first.persisted.recommendations[0].recommendationId);
    expect(stored?.summary).toBe("updated");
    const list = await repos.recommendations.listByOrganization(ORG_A);
    expect(list.filter((r) => r.recommendationId === first.persisted.recommendations[0].recommendationId).length).toBe(1);
  });
});
