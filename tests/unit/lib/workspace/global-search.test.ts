import { describe, it, expect } from "vitest";
import { GlobalSearchEngine } from "@/lib/workspace/global-search";

describe("Global Search Explainability", () => {
  it("reports consulted, ignored modules, filters, timing, and count", async () => {
    const s = new GlobalSearchEngine();
    s.register("actions", async (t, org) => [{ id: "a1", module: "actions", title: `A ${t}`, score: 0.9, refs: [org] }]);
    s.register("insights", async () => [{ id: "i1", module: "insights", title: "I", score: 0.5, refs: [] }]);
    const { results, explanation } = await s.search({
      organizationId: "org_a", userId: "u1", text: "hello",
      modules: ["actions", "insights", "reports"], // reports unregistered → ignored
      filters: { severity: "critical" },
    });
    expect(results).toHaveLength(2);
    expect(results[0].score).toBeGreaterThanOrEqual(results[1].score);
    expect(explanation.consultedModules).toEqual(expect.arrayContaining(["actions", "insights"]));
    expect(explanation.ignoredModules).toContain("reports");
    expect(explanation.filtersApplied).toEqual({ severity: "critical" });
    expect(explanation.resultCount).toBe(2);
    expect(explanation.responseTimeMs).toBeGreaterThanOrEqual(0);
  });

  it("marks failing modules as ignored without throwing", async () => {
    const s = new GlobalSearchEngine();
    s.register("actions", async () => { throw new Error("boom"); });
    const { results, explanation } = await s.search({ organizationId: "o", userId: "u", text: "x" });
    expect(results).toHaveLength(0);
    expect(explanation.ignoredModules).toContain("actions");
  });
});
