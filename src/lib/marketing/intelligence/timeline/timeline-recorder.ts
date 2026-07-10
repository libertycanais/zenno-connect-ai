// FEATURE — Marketing Intelligence · Unified Timeline recorder (in-memory ring)
import type { MarketingProvider } from "../../contracts/assets";

export type TimelineStage =
  | "connection.ready" | "discovery" | "sync.first" | "experts.executed"
  | "executive.generated" | "recommendations.generated" | "health.updated"
  | "context.updated";

export type TimelineRecord = {
  id: string;
  timestamp: string;
  organizationId: string;
  provider: MarketingProvider;
  stage: TimelineStage;
  status: "ok" | "warn" | "error";
  latencyMs: number;
  source: string;
  meta?: Record<string, unknown>;
};

const buffer: TimelineRecord[] = [];
const MAX = 500;

export function recordTimeline(evt: Omit<TimelineRecord, "id" | "timestamp"> & { timestamp?: string }): TimelineRecord {
  const rec: TimelineRecord = {
    id: `tl_${Math.random().toString(36).slice(2, 10)}`,
    timestamp: evt.timestamp ?? new Date().toISOString(),
    ...evt,
  };
  buffer.push(rec);
  if (buffer.length > MAX) buffer.splice(0, buffer.length - MAX);
  return rec;
}

export function listTimeline(organizationId: string): TimelineRecord[] {
  return buffer.filter((r) => r.organizationId === organizationId).slice().reverse();
}

export function clearTimeline(): void { buffer.length = 0; }
