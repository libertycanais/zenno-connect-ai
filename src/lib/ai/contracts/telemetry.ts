// EPIC A — Zenno Brain · Telemetry contracts (contracts only, no dispatch)
import type { AIAgent, AIProviderName } from "../types";

export type TelemetryEventName =
  | "PlannerStarted" | "PlannerFinished"
  | "WorkflowStarted" | "WorkflowFinished"
  | "ProviderSelected"
  | "RecommendationGenerated"
  | "ArtifactCreated"
  | "DecisionCompleted";

export type TelemetryEvent = {
  eventId: string;
  name: TelemetryEventName;
  organizationId: string;
  userId: string;
  agent: AIAgent | null;
  provider: AIProviderName | null;
  model: string | null;
  planId: string | null;
  workflowId: string | null;
  taskId: string | null;
  timestamp: string;
  latencyMs: number | null;
  costCents: number | null;
  meta: Record<string, unknown>;
};

export interface TelemetrySink {
  emit(event: TelemetryEvent): void | Promise<void>;
}
