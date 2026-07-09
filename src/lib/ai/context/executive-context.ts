import type { ContextReaders } from "./readers";
import { runSlice, type SliceRunnerDeps } from "./slice-runner";
import type { ExecutiveSlice, WithMeta } from "./types";

export function loadExecutiveContext(
  organizationId: string,
  userId: string,
  readers: ContextReaders,
  deps: SliceRunnerDeps,
): Promise<WithMeta<ExecutiveSlice>> {
  return runSlice("executive", organizationId, () => readers.executive({ organizationId, userId }), deps);
}
