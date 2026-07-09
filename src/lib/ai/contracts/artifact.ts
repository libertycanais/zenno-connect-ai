// EPIC A — Zenno Brain · Artifact contracts (surface only)
export type ArtifactKind =
  | "analysis" | "recommendation" | "forecast" | "report"
  | "workflow-result" | "chart" | "text" | "json";

export type Artifact = {
  artifactId: string;
  organizationId: string;
  planId: string | null;
  workflowId: string | null;
  kind: ArtifactKind;
  version: number;
  fingerprint: string;                 // sha256(16)
  body: unknown;                       // structured payload
  createdAt: string;
  createdBy: {
    skillId: string | null;
    provider: string | null;
    model: string | null;
  };
};
