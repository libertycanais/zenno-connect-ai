import type { ContextReaders } from "./readers";
import { runSlice, type SliceRunnerDeps } from "./slice-runner";
import type { WhatsAppSlice, WithMeta } from "./types";

export function loadWhatsAppContext(
  organizationId: string,
  userId: string,
  readers: ContextReaders,
  deps: SliceRunnerDeps,
): Promise<WithMeta<WhatsAppSlice>> {
  return runSlice("whatsapp", organizationId, () => readers.whatsapp({ organizationId, userId }), deps);
}
