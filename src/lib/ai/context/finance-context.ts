import type { ContextReaders } from "./readers";
import { runSlice, type SliceRunnerDeps } from "./slice-runner";
import type { FinanceSlice, WithMeta } from "./types";

export function loadFinanceContext(
  organizationId: string,
  userId: string,
  readers: ContextReaders,
  deps: SliceRunnerDeps,
): Promise<WithMeta<FinanceSlice>> {
  return runSlice("finance", organizationId, () => readers.finance({ organizationId, userId }), deps);
}
