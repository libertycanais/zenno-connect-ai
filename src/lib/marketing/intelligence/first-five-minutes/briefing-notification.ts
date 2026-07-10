// FEATURE — First Five Minutes · Briefing notification queue (additive)
// CTO rule: "Nunca abrir conversa automaticamente." Copilot never auto-opens.
// Instead, we enqueue a *discreet* notification the user can accept or dismiss.
import type { ProactiveBriefing } from "../copilot/proactive-briefing";

export type BriefingNotification = {
  id: string;
  organizationId: string;
  briefing: ProactiveBriefing;
  createdAt: string;
  status: "pending" | "seen" | "dismissed";
  seenAt?: string;
  dismissedAt?: string;
};

const queue: BriefingNotification[] = [];
const QUEUE_LIMIT = 100;

function id(): string {
  return `brief_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function enqueueBriefingNotification(
  organizationId: string,
  briefing: ProactiveBriefing,
): BriefingNotification {
  // Collapse pending duplicates per organization (only one pending at a time).
  const idx = queue.findIndex((n) => n.organizationId === organizationId && n.status === "pending");
  if (idx >= 0) queue.splice(idx, 1);

  const notification: BriefingNotification = {
    id: id(),
    organizationId,
    briefing,
    createdAt: new Date().toISOString(),
    status: "pending",
  };
  queue.push(notification);
  if (queue.length > QUEUE_LIMIT) queue.splice(0, queue.length - QUEUE_LIMIT);
  return notification;
}

export function getPendingBriefing(organizationId: string): BriefingNotification | null {
  for (let i = queue.length - 1; i >= 0; i--) {
    const n = queue[i];
    if (n.organizationId === organizationId && n.status === "pending") return n;
  }
  return null;
}

export function markBriefingSeen(id: string): BriefingNotification | null {
  const n = queue.find((x) => x.id === id);
  if (!n) return null;
  n.status = "seen";
  n.seenAt = new Date().toISOString();
  return n;
}

export function dismissBriefing(id: string): BriefingNotification | null {
  const n = queue.find((x) => x.id === id);
  if (!n) return null;
  n.status = "dismissed";
  n.dismissedAt = new Date().toISOString();
  return n;
}

export function listBriefings(organizationId: string): BriefingNotification[] {
  return queue.filter((n) => n.organizationId === organizationId);
}

export function clearBriefings(): void {
  queue.length = 0;
}
