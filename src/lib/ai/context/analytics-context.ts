import type { ContextReaders } from "./readers";
import { runSlice, type SliceRunnerDeps } from "./slice-runner";
import type { AnalyticsSlice, WithMeta } from "./types";

export function loadAnalyticsContext(
  organizationId: string,
  userId: string,
  readers: ContextReaders,
  deps: SliceRunnerDeps,
): Promise<WithMeta<AnalyticsSlice>> {
  return runSlice("analytics", organizationId, () => readers.analytics({ organizationId, userId }), deps);
}
