// EPIC H — Knowledge Lineage
// Every recommendation must be traceable to Signals → KPIs → DNA → Memory
// → Knowledge → Rules → Expert → Provider → Recommendation.

export type LineageNode = {
  organizationId: string;
  recommendationId: string;
  signalIds: string[];
  kpiIds: string[];
  businessDnaVersion: number | null;
  memoryIds: string[];
  knowledgeDomains: string[];
  ruleIds: string[];
  expertId: string;
  provider: string;
  model: string;
  createdAt: string;
};

export class KnowledgeLineageStore {
  private nodes: LineageNode[] = [];

  record(node: Omit<LineageNode, "createdAt">): LineageNode {
    if (!node.expertId || !node.provider) {
      throw new Error("lineage requires expertId and provider");
    }
    if (!node.signalIds.length && !node.kpiIds.length && !node.memoryIds.length) {
      throw new Error("lineage requires at least one origin (signal/kpi/memory)");
    }
    const rec: LineageNode = { ...node, createdAt: new Date().toISOString() };
    this.nodes.push(rec);
    return rec;
  }

  get(recommendationId: string, organizationId: string): LineageNode | null {
    const n = this.nodes.find((x) => x.recommendationId === recommendationId);
    if (!n || n.organizationId !== organizationId) return null;
    return n;
  }

  list(organizationId: string): LineageNode[] {
    return this.nodes.filter((n) => n.organizationId === organizationId);
  }
}

export const knowledgeLineageStore = new KnowledgeLineageStore();

export const LineageValidator = {
  isComplete(node: LineageNode): boolean {
    return (
      (node.signalIds.length + node.kpiIds.length + node.memoryIds.length) > 0 &&
      node.ruleIds.length >= 0 &&
      !!node.expertId &&
      !!node.provider
    );
  },
};
