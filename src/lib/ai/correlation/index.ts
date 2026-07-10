// Correlation Engine — Pearson correlation + signal co-occurrence graph (pure).
import type { BusinessSignal } from "../signals/types";

export function pearson(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length);
  if (n < 2) return 0;
  const ma = a.slice(0, n).reduce((x, y) => x + y, 0) / n;
  const mb = b.slice(0, n).reduce((x, y) => x + y, 0) / n;
  let num = 0, da = 0, db = 0;
  for (let i = 0; i < n; i++) {
    const xa = a[i] - ma, xb = b[i] - mb;
    num += xa * xb; da += xa * xa; db += xb * xb;
  }
  const denom = Math.sqrt(da * db);
  return denom === 0 ? 0 : num / denom;
}

export type CorrelationEdge = { from: string; to: string; support: number };

export function coOccurrence(signals: BusinessSignal[]): CorrelationEdge[] {
  const buckets = new Map<string, Set<string>>();  // orgId+day -> set of types
  for (const s of signals) {
    const key = `${s.organizationId}:${s.createdAt.slice(0, 10)}`;
    (buckets.get(key) ?? buckets.set(key, new Set()).get(key)!).add(s.type);
  }
  const pairCounts = new Map<string, number>();
  for (const set of buckets.values()) {
    const types = [...set];
    for (let i = 0; i < types.length; i++) {
      for (let j = i + 1; j < types.length; j++) {
        const [a, b] = [types[i], types[j]].sort();
        const key = `${a}|${b}`;
        pairCounts.set(key, (pairCounts.get(key) ?? 0) + 1);
      }
    }
  }
  return [...pairCounts.entries()].map(([k, v]) => {
    const [from, to] = k.split("|");
    return { from, to, support: v };
  });
}
