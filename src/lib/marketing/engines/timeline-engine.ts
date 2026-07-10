// FEATURE — Marketing Platform · Timeline factory
// Append-only helpers. Persistence lives in server functions.

import type { MarketingTimelineEvent, TimelineEventType } from "../contracts/timeline";
import type { MarketingProvider } from "../contracts/assets";

export function makeTimelineEvent(input: {
  organizationId: string;
  eventType: TimelineEventType;
  severity?: MarketingTimelineEvent["severity"];
  provider?: MarketingProvider | null;
  connectionId?: string | null;
  assetId?: string | null;
  payload?: Record<string, unknown>;
}): MarketingTimelineEvent {
  return {
    organizationId: input.organizationId,
    connectionId: input.connectionId ?? null,
    assetId: input.assetId ?? null,
    provider: input.provider ?? null,
    eventType: input.eventType,
    severity: input.severity ?? "info",
    payload: input.payload ?? {},
    occurredAt: new Date().toISOString(),
  };
}
