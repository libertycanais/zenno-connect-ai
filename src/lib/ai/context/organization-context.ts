import type { ContextReaders } from "./readers";
import { runSlice, type SliceRunnerDeps } from "./slice-runner";
import type { OrganizationSlice, WithMeta } from "./types";

export function loadOrganizationContext(
  organizationId: string,
  userId: string,
  readers: ContextReaders,
  deps: SliceRunnerDeps,
): Promise<WithMeta<OrganizationSlice>> {
  return runSlice("organization", organizationId, () => readers.organization({ organizationId, userId }), deps);
}
