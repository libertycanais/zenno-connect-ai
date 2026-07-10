// In-memory ring buffer of emitted signals per org.
import type { BusinessSignal } from "../signals/types";
import type { SignalHistoryEntry } from "./types";

export class SignalHistory {
  private store = new Map<string, SignalHistoryEntry[]>();
  constructor(private readonly max = 500) {}

  push(signal: BusinessSignal): void {
    const list = this.store.get(signal.organizationId) ?? [];
    list.push({ signal, emittedAt: new Date().toISOString() });
    if (list.length > this.max) list.splice(0, list.length - this.max);
    this.store.set(signal.organizationId, list);
  }
  list(orgId: string): SignalHistoryEntry[] { return this.store.get(orgId) ?? []; }
  clear(orgId?: string): void { orgId ? this.store.delete(orgId) : this.store.clear(); }
}
