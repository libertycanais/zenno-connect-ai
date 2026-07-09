import { describe, it, expect } from "vitest";
import { DecisionGraphBuilder } from "@/lib/ai/decision-graph";

describe("DecisionGraphBuilder", () => {
  it("adds nodes and edges", () => {
    const b = new DecisionGraphBuilder("org-1", "plan_abc");
    const n1 = b.addNode("planner", "Planner");
    const n2 = b.addNode("rule", "budget.max_cost");
    b.addEdge(n1.id, n2.id, "validated_by");
    const g = b.build();
    expect(g.nodes.length).toBe(2);
    expect(g.edges.length).toBe(1);
    expect(g.planId).toBe("plan_abc");
  });

  it("rejects self-loops", () => {
    const b = new DecisionGraphBuilder("org-1", null);
    const n1 = b.addNode("planner", "P");
    expect(() => b.addEdge(n1.id, n1.id, "depends_on")).toThrow(/Self-loop/);
  });

  it("rejects cycles", () => {
    const b = new DecisionGraphBuilder("org-1", null);
    const a = b.addNode("planner", "A");
    const c = b.addNode("skill", "B");
    const d = b.addNode("provider", "C");
    b.addEdge(a.id, c.id, "depends_on");
    b.addEdge(c.id, d.id, "depends_on");
    expect(() => b.addEdge(d.id, a.id, "depends_on")).toThrow(/Cycle/);
  });

  it("rejects edges referring to unknown nodes", () => {
    const b = new DecisionGraphBuilder("org-1", null);
    expect(() => b.addEdge("x", "y", "depends_on")).toThrow(/Unknown/);
  });
});
