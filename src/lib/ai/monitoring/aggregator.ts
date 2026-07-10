// Cross-run aggregator: merges signals from concurrent jobs into a coherent set.
import type { BusinessSignal } from "../signals/types";

export function mergeSignals(...batches: BusinessSignal[][]): BusinessSignal[] {
  const map = new Map<string, BusinessSignal>();
  for (const batch of batches) {
    for (const s of batch) {
      const key = `${s.organizationId}:${s.dedupeKey}`;
      const cur = map.get(key);
      if (!cur || s.score > cur.score) map.set(key, s);
    }
  }
  return [...map.values()];
}
