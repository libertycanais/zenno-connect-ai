// Suppresses duplicate signals sharing dedupeKey within a window.
import type { BusinessSignal } from "../signals/types";

export class SignalDeduplicator {
  private seen = new Map<string, number>();
  constructor(private readonly windowMs = 15 * 60_000) {}

  shouldEmit(signal: BusinessSignal, now = Date.now()): boolean {
    const key = `${signal.organizationId}:${signal.dedupeKey}`;
    const last = this.seen.get(key);
    if (last !== undefined && now - last < this.windowMs) return false;
    this.seen.set(key, now);
    return true;
  }
  reset(): void { this.seen.clear(); }
}
