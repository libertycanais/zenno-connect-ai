// EPIC I — Executive Cache (org-scoped, TTL, in-memory)
export type CacheEntry<T> = { value: T; expiresAt: number };

export class ExecutiveCache<T> {
  private byKey = new Map<string, CacheEntry<T>>();

  set(orgId: string, key: string, value: T, ttlMs: number): void {
    this.byKey.set(this.k(orgId, key), { value, expiresAt: Date.now() + ttlMs });
  }
  get(orgId: string, key: string): T | null {
    const e = this.byKey.get(this.k(orgId, key));
    if (!e) return null;
    if (e.expiresAt < Date.now()) { this.byKey.delete(this.k(orgId, key)); return null; }
    return e.value;
  }
  invalidate(orgId: string, key?: string): void {
    if (key) { this.byKey.delete(this.k(orgId, key)); return; }
    for (const k of [...this.byKey.keys()]) if (k.startsWith(`${orgId}::`)) this.byKey.delete(k);
  }
  private k(o: string, k: string): string { return `${o}::${k}`; }
}
