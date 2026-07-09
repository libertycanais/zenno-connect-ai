import type { ContextReaders } from "./readers";
import { runSlice, type SliceRunnerDeps } from "./slice-runner";
import type { TrackingSlice, WithMeta } from "./types";

export function loadTrackingContext(
  organizationId: string,
  userId: string,
  readers: ContextReaders,
  deps: SliceRunnerDeps,
): Promise<WithMeta<TrackingSlice>> {
  return runSlice("tracking", organizationId, () => readers.tracking({ organizationId, userId }), deps);
}
