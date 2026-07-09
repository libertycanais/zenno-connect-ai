// EPIC F — Performance helpers (additive).
// Deduplica chamadas concorrentes com a mesma chave e memoiza resultados
// por um TTL curto. Sem estado persistente; ideal para edge/worker.

type Entry<T> = { value: T; expiresAt: number };

export class InflightDedup<T> {
  private readonly inflight = new Map<string, Promise<T>>();
  private readonly cache = new Map<string, Entry<T>>();

  constructor(private readonly ttlMs = 5_000) {}

  async run(key: string, fn: () => Promise<T>): Promise<T> {
    const now = Date.now();
    const cached = this.cache.get(key);
    if (cached && cached.expiresAt > now) return cached.value;

    const existing = this.inflight.get(key);
    if (existing) return existing;

    const p = (async () => {
      try {
        const value = await fn();
        this.cache.set(key, { value, expiresAt: Date.now() + this.ttlMs });
        return value;
      } finally {
        this.inflight.delete(key);
      }
    })();
    this.inflight.set(key, p);
    return p;
  }

  invalidate(key: string): void { this.cache.delete(key); }
  size(): { inflight: number; cache: number } { return { inflight: this.inflight.size, cache: this.cache.size }; }
}
