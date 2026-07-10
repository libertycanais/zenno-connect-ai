// Per-signal-type cooldown per organization.
export class SignalCooldown {
  private buckets = new Map<string, number>();
  constructor(private readonly defaultMs = 60 * 60_000) {}
  isCooling(orgId: string, type: string, now = Date.now()): boolean {
    const last = this.buckets.get(`${orgId}:${type}`);
    return last !== undefined && now - last < this.defaultMs;
  }
  mark(orgId: string, type: string, now = Date.now()): void {
    this.buckets.set(`${orgId}:${type}`, now);
  }
  reset(): void { this.buckets.clear(); }
}
