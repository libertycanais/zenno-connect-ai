// EPIC J — NotificationCenter · multi-channel contracts (queue-only in this Epic)
import type {
  NotificationChannel, NotificationDispatchResult, NotificationRequest,
  NotificationTransport, OrgScoped,
} from "../types";

const now = (): string => new Date().toISOString();

export class NotificationCenter {
  private transports = new Map<NotificationChannel, NotificationTransport>();
  private queueByOrg = new Map<string, NotificationRequest[]>();
  private history = new Map<string, NotificationDispatchResult[]>();

  register(transport: NotificationTransport): void {
    this.transports.set(transport.channel, transport);
  }

  hasTransport(c: NotificationChannel): boolean { return this.transports.has(c); }

  enqueue(n: NotificationRequest): void {
    const list = this.queueByOrg.get(n.organizationId) ?? [];
    list.push(n);
    this.queueByOrg.set(n.organizationId, list);
  }

  peek(o: OrgScoped): NotificationRequest[] {
    return (this.queueByOrg.get(o.organizationId) ?? []).slice();
  }

  async dispatchOne(n: NotificationRequest): Promise<NotificationDispatchResult> {
    const t = this.transports.get(n.channel);
    if (!t) {
      const skipped: NotificationDispatchResult = {
        notificationId: n.id, channel: n.channel, status: "skipped",
        reason: "no_transport", attemptedAt: now(),
      };
      this.recordHistory(n.organizationId, skipped);
      return skipped;
    }
    try {
      const r = await t.send(n);
      this.recordHistory(n.organizationId, r);
      return r;
    } catch (e) {
      const failed: NotificationDispatchResult = {
        notificationId: n.id, channel: n.channel, status: "failed",
        reason: e instanceof Error ? e.message : String(e),
        attemptedAt: now(),
      };
      this.recordHistory(n.organizationId, failed);
      return failed;
    }
  }

  async flush(o: OrgScoped): Promise<NotificationDispatchResult[]> {
    const list = this.queueByOrg.get(o.organizationId) ?? [];
    this.queueByOrg.set(o.organizationId, []);
    const results: NotificationDispatchResult[] = [];
    for (const n of list) results.push(await this.dispatchOne(n));
    return results;
  }

  historyFor(o: OrgScoped): NotificationDispatchResult[] {
    return (this.history.get(o.organizationId) ?? []).slice();
  }

  private recordHistory(org: string, r: NotificationDispatchResult): void {
    const list = this.history.get(org) ?? [];
    list.unshift(r);
    this.history.set(org, list);
  }
}

/** Null transport used as safe default when no real integration exists yet. */
export class NullTransport implements NotificationTransport {
  constructor(public readonly channel: NotificationChannel) {}
  async send(n: NotificationRequest): Promise<NotificationDispatchResult> {
    return { notificationId: n.id, channel: this.channel, status: "queued", attemptedAt: now() };
  }
}
