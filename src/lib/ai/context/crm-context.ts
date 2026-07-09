import type { ContextReaders } from "./readers";
import { runSlice, type SliceRunnerDeps } from "./slice-runner";
import type { CrmSlice, WithMeta } from "./types";

export function loadCrmContext(
  organizationId: string,
  userId: string,
  readers: ContextReaders,
  deps: SliceRunnerDeps,
): Promise<WithMeta<CrmSlice>> {
  return runSlice("crm", organizationId, () => readers.crm({ organizationId, userId }), deps);
}
