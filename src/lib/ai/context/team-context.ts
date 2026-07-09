import type { ContextReaders } from "./readers";
import { runSlice, type SliceRunnerDeps } from "./slice-runner";
import type { TeamSlice, WithMeta } from "./types";

export function loadTeamContext(
  organizationId: string,
  userId: string,
  readers: ContextReaders,
  deps: SliceRunnerDeps,
): Promise<WithMeta<TeamSlice>> {
  return runSlice("team", organizationId, () => readers.team({ organizationId, userId }), deps);
}
