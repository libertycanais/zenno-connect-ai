// EPIC A — Zenno Brain · Decision Graph contracts
export type DecisionNodeKind =
  | "planner" | "rule" | "skill" | "provider" | "recommendation" | "artifact" | "workflow" | "step";

export type DecisionEdgeKind =
  | "depends_on" | "generated_by" | "validated_by" | "produces" | "supersedes";

export type DecisionNode = {
  id: string;
  kind: DecisionNodeKind;
  label: string;
  data: Record<string, unknown>;
  createdAt: string;
};

export type DecisionEdge = {
  id: string;
  from: string;                        // node id
  to: string;                          // node id
  kind: DecisionEdgeKind;
  createdAt: string;
};

export type DecisionGraph = {
  graphId: string;
  organizationId: string;
  planId: string | null;
  nodes: DecisionNode[];
  edges: DecisionEdge[];
  createdAt: string;
};
