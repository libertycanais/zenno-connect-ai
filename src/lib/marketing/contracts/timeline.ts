// FEATURE — Marketing Platform Connector · Unified Marketing Timeline
import type { MarketingProvider } from "./assets";

export type TimelineEventType =
  | "connection.started"
  | "connection.succeeded"
  | "connection.failed"
  | "connection.revoked"
  | "discovery.completed"
  | "asset.bound"
  | "asset.unbound"
  | "sync.started"
  | "sync.succeeded"
  | "sync.failed"
  | "health.degraded"
  | "health.recovered";

export type MarketingTimelineEvent = {
  id?: string;
  organizationId: string;
  connectionId?: string | null;
  assetId?: string | null;
  provider?: MarketingProvider | null;
  eventType: TimelineEventType;
  severity: "info" | "warning" | "error" | "success";
  payload: Record<string, unknown>;
  occurredAt: string;
};
