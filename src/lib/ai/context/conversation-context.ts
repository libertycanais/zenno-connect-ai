import type { ContextReaders } from "./readers";
import { runSlice, type SliceRunnerDeps } from "./slice-runner";
import type { ConversationSlice, WithMeta } from "./types";

export function loadConversationContext(
  organizationId: string,
  userId: string,
  readers: ContextReaders,
  deps: SliceRunnerDeps,
  conversationId?: string | null,
): Promise<WithMeta<ConversationSlice>> {
  return runSlice(
    "conversation",
    organizationId,
    () => readers.conversation({ organizationId, userId, conversationId: conversationId ?? null }),
    deps,
  );
}

/** Keep only the last N turns to bound conversation growth. */
export function trimConversation(slice: ConversationSlice, maxTurns: number): ConversationSlice {
  const capped = Math.max(1, maxTurns);
  return { ...slice, recentTurns: slice.recentTurns.slice(-capped) };
}
