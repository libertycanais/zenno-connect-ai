import type { ContextReaders } from "./readers";
import { runSlice, type SliceRunnerDeps } from "./slice-runner";
import type { MemorySlice, WithMeta } from "./types";

export function loadMemoryContext(
  organizationId: string,
  userId: string,
  readers: ContextReaders,
  deps: SliceRunnerDeps,
): Promise<WithMeta<MemorySlice>> {
  return runSlice("memory", organizationId, () => readers.memory({ organizationId, userId }), deps);
}

/** Merge two memory slices deferring to the newer entry per (scope,key). */
export function mergeMemorySlices(a: MemorySlice | null, b: MemorySlice | null): MemorySlice {
  const empty: MemorySlice = { objectives: [], preferences: [], restrictions: [], insights: [] };
  const base = a ?? empty;
  const other = b ?? empty;
  const mergeArr = (x: MemorySlice["objectives"], y: MemorySlice["objectives"]) => {
    const map = new Map<string, MemorySlice["objectives"][number]>();
    for (const e of x) map.set(e.key, e);
    for (const e of y) map.set(e.key, e); // b wins
    return [...map.values()];
  };
  return {
    objectives: mergeArr(base.objectives, other.objectives),
    preferences: mergeArr(base.preferences, other.preferences),
    restrictions: mergeArr(base.restrictions, other.restrictions),
    insights: mergeArr(base.insights, other.insights),
  };
}
