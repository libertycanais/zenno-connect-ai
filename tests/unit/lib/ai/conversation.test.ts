// P0.6 · Onda 3 — Conversation Engine
import { describe, expect, it } from "vitest";
import { ConversationEngine, deriveTitle, trimHistory, shouldSummarize, type ConversationStore, type ConversationRow, type PersistedMessage } from "@/lib/ai/conversation";

function makeStore(): ConversationStore & { messages: PersistedMessage[]; rows: ConversationRow[] } {
  const rows: ConversationRow[] = [];
  const messages: PersistedMessage[] = [];
  return {
    rows, messages,
    async create(input) {
      const r: ConversationRow = {
        id: `c-${rows.length + 1}`,
        organization_id: input.organizationId,
        user_id: input.userId,
        title: input.title ?? null,
        agent: input.agent,
        provider: null, model: null, status: "active",
        message_count: 0, task_count: 0, total_tokens: 0, total_cost_cents: 0,
        last_message_at: null, created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(), summary: null,
      };
      rows.push(r);
      return r;
    },
    async load(id) { return rows.find((r) => r.id === id) ?? null; },
    async archive(id) {
      const r = rows.find((r) => r.id === id);
      if (r) r.status = "archived";
    },
    async updateSummary(id, summary) {
      const r = rows.find((r) => r.id === id);
      if (r) r.summary = summary;
    },
    async appendMessage(msg) {
      const m: PersistedMessage = { ...msg, id: `m-${messages.length + 1}`, created_at: new Date().toISOString() };
      messages.push(m);
      return m;
    },
    async listMessages(id) { return messages.filter((m) => m.conversation_id === id); },
  };
}

describe("Conversation Engine", () => {
  it("deriveTitle trims and truncates", () => {
    expect(deriveTitle("  hello world  ")).toBe("hello world");
    expect(deriveTitle("")).toBe("Nova conversa");
    expect(deriveTitle("x".repeat(200)).endsWith("…")).toBe(true);
  });

  it("trimHistory keeps the last N", () => {
    const msgs = Array.from({ length: 10 }, (_, i) => ({ id: String(i) } as unknown as PersistedMessage));
    expect(trimHistory(msgs, 3).length).toBe(3);
    expect(trimHistory(msgs, 20).length).toBe(10);
  });

  it("shouldSummarize obeys soft limit", () => {
    const msgs = Array.from({ length: 41 }, () => ({} as PersistedMessage));
    expect(shouldSummarize(msgs)).toBe(true);
    expect(shouldSummarize([])).toBe(false);
  });

  it("start persists conversation with derived title", async () => {
    const store = makeStore();
    const engine = new ConversationEngine(store);
    const c = await engine.start({ organizationId: "o1", userId: "u1", agent: "free_chat", firstMessage: "Hello there" });
    expect(c.title).toBe("Hello there");
    expect(store.rows).toHaveLength(1);
  });

  it("archive flips status", async () => {
    const store = makeStore();
    const engine = new ConversationEngine(store);
    const c = await engine.start({ organizationId: "o1", userId: "u1", agent: "free_chat" });
    await engine.archive(c.id);
    expect(store.rows[0]!.status).toBe("archived");
  });

  it("append + loadHistory returns messages in order", async () => {
    const store = makeStore();
    const engine = new ConversationEngine(store);
    const c = await engine.start({ organizationId: "o1", userId: "u1", agent: "free_chat" });
    await engine.append({
      conversation_id: c.id, role: "user", content: "hi",
      provider: null, model: null, tokens_in: 0, tokens_out: 0, latency_ms: null, metadata: {},
    });
    const hist = await engine.loadHistory(c.id);
    expect(hist).toHaveLength(1);
    expect(hist[0]!.content).toBe("hi");
  });
});
