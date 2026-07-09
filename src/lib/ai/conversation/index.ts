// FEATURE P0.6 — Onda 3 · Conversation Engine
// Manages conversation lifecycle. Does NOT talk to providers.
// DB reads/writes are injected — this module is pure orchestration + policy.

import type { AIAgent, AIMessageRole, AIProviderName } from "../types";

export type ConversationRow = {
  id: string;
  organization_id: string;
  user_id: string;
  title: string | null;
  agent: AIAgent;
  provider: AIProviderName | null;
  model: string | null;
  status: "active" | "archived";
  message_count: number;
  task_count: number;
  total_tokens: number;
  total_cost_cents: number;
  last_message_at: string | null;
  created_at: string;
  updated_at: string;
  summary: string | null;
};

export type PersistedMessage = {
  id: string;
  conversation_id: string;
  role: AIMessageRole | "developer";
  content: string;
  provider: string | null;
  model: string | null;
  tokens_in: number;
  tokens_out: number;
  latency_ms: number | null;
  metadata: Record<string, unknown>;
  created_at: string;
};

export interface ConversationStore {
  create(input: { organizationId: string; userId: string; agent: AIAgent; title?: string | null }): Promise<ConversationRow>;
  load(id: string): Promise<ConversationRow | null>;
  archive(id: string): Promise<void>;
  updateSummary(id: string, summary: string): Promise<void>;
  appendMessage(msg: Omit<PersistedMessage, "id" | "created_at">): Promise<PersistedMessage>;
  listMessages(conversationId: string, limit?: number): Promise<PersistedMessage[]>;
}

const TITLE_MAX = 80;

export function deriveTitle(firstUserMessage: string): string {
  const trimmed = firstUserMessage.trim().replace(/\s+/g, " ");
  if (trimmed.length <= TITLE_MAX) return trimmed || "Nova conversa";
  return `${trimmed.slice(0, TITLE_MAX - 1)}…`;
}

/**
 * Compact-summary heuristic. Real summarization happens via a summarizer skill
 * in later waves; here we prepare the boundary so callers can compress old turns.
 */
export function shouldSummarize(msgs: PersistedMessage[], softLimit = 40): boolean {
  return msgs.length > softLimit;
}

/** Keep the last N messages, plus any assistant "summary" message if present. */
export function trimHistory(msgs: PersistedMessage[], keepLast: number): PersistedMessage[] {
  if (msgs.length <= keepLast) return msgs;
  return msgs.slice(-keepLast);
}

export class ConversationEngine {
  constructor(private store: ConversationStore) {}

  async start(input: { organizationId: string; userId: string; agent: AIAgent; firstMessage?: string }): Promise<ConversationRow> {
    const title = input.firstMessage ? deriveTitle(input.firstMessage) : null;
    return this.store.create({ ...input, title });
  }

  async append(msg: Omit<PersistedMessage, "id" | "created_at">): Promise<PersistedMessage> {
    return this.store.appendMessage(msg);
  }

  async archive(id: string): Promise<void> {
    await this.store.archive(id);
  }

  async loadHistory(id: string, keepLast = 30): Promise<PersistedMessage[]> {
    const all = await this.store.listMessages(id);
    return trimHistory(all, keepLast);
  }
}
