import type { ContextReaders } from "./readers";
import { runSlice, type SliceRunnerDeps } from "./slice-runner";
import type { BillingSlice, WithMeta } from "./types";

export function loadBillingContext(
  organizationId: string,
  userId: string,
  readers: ContextReaders,
  deps: SliceRunnerDeps,
): Promise<WithMeta<BillingSlice>> {
  return runSlice("billing", organizationId, () => readers.billing({ organizationId, userId }), deps);
}
