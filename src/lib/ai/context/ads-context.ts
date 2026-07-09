import type { ContextReaders } from "./readers";
import { runSlice, type SliceRunnerDeps } from "./slice-runner";
import type { AdsSlice, WithMeta } from "./types";

export function loadAdsContext(
  organizationId: string,
  userId: string,
  readers: ContextReaders,
  deps: SliceRunnerDeps,
): Promise<WithMeta<AdsSlice>> {
  return runSlice("ads", organizationId, () => readers.ads({ organizationId, userId }), deps);
}
