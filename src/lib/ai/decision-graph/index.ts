// EPIC A — Zenno Brain · Decision Graph
// Append-only DAG of decisions. Cycles are rejected at insertion time.
// Never touches providers or DB. Structural only.

import type {
  DecisionGraph, DecisionNode, DecisionEdge, DecisionNodeKind, DecisionEdgeKind,
} from "../contracts/decision";

export * from "../contracts/decision";

function nextId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

export class DecisionGraphBuilder {
  private graph: DecisionGraph;
  private adjacency = new Map<string, Set<string>>();

  constructor(organizationId: string, planId: string | null) {
    this.graph = {
      graphId: nextId("dg"),
      organizationId,
      planId,
      nodes: [],
      edges: [],
      createdAt: new Date().toISOString(),
    };
  }

  addNode(kind: DecisionNodeKind, label: string, data: Record<string, unknown> = {}): DecisionNode {
    const node: DecisionNode = {
      id: nextId("node"), kind, label, data,
      createdAt: new Date().toISOString(),
    };
    this.graph.nodes.push(node);
    this.adjacency.set(node.id, new Set());
    return node;
  }

  addEdge(from: string, to: string, kind: DecisionEdgeKind): DecisionEdge {
    if (from === to) throw new Error("Self-loop not allowed");
    if (!this.adjacency.has(from) || !this.adjacency.has(to)) {
      throw new Error("Unknown node in edge");
    }
    // Prevent cycles: check if `from` is reachable from `to` (which would
    // create a cycle when we add `from -> to`).
    if (this.reachable(to, from)) throw new Error("Cycle detected");
    const edge: DecisionEdge = {
      id: nextId("edge"), from, to, kind,
      createdAt: new Date().toISOString(),
    };
    this.graph.edges.push(edge);
    this.adjacency.get(from)!.add(to);
    return edge;
  }

  private reachable(start: string, target: string): boolean {
    if (start === target) return true;
    const stack = [start];
    const seen = new Set<string>();
    while (stack.length) {
      const cur = stack.pop()!;
      if (cur === target) return true;
      if (seen.has(cur)) continue;
      seen.add(cur);
      const nexts = this.adjacency.get(cur);
      if (nexts) for (const n of nexts) stack.push(n);
    }
    return false;
  }

  build(): DecisionGraph { return this.graph; }
}
