// FEATURE P0.6 — Onda 1 · Server functions surface (safe reads)
// This is the ONLY entrypoint the UI has into the AI infra for Wave 1.
// Actual chat/task execution lands in Wave 3.
//
// All functions are authenticated; RLS enforces org isolation.
// Credentials read via the `ai_provider_credentials_safe` view (no ciphertext).

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { AI_PROVIDERS } from "@/lib/ai/types";

export const listAIProviderCredentials = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await (context.supabase as any)
      .from("ai_provider_credentials_safe")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { credentials: data ?? [] };
  });

export const listAIConversations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await (context.supabase as any)
      .from("ai_conversations")
      .select("id, title, agent, provider, model, status, message_count, task_count, total_tokens, total_cost_cents, last_message_at, created_at, updated_at")
      .eq("status", "active")
      .order("updated_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return { conversations: data ?? [] };
  });

const listTasksInput = z.object({
  type: z.enum(["AI", "SYNC", "IMPORT", "EXPORT", "AUTOMATION", "REPORT", "BILLING", "AUDIT"]).optional(),
  limit: z.number().int().min(1).max(200).optional().default(50),
});

export const listTasks = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => listTasksInput.parse(raw))
  .handler(async ({ data, context }) => {
    let q = (context.supabase as any)
      .from("tasks")
      .select("id, type, category, status, priority, provider, model, tokens_in, tokens_out, estimated_cost_cents, duration_ms, error_code, started_at, finished_at, conversation_id, created_at")
      .order("created_at", { ascending: false })
      .limit(data.limit ?? 50);
    if (data.type) q = q.eq("type", data.type);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return { tasks: rows ?? [] };
  });

export const listAIUsage = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await (context.supabase as any)
      .from("ai_usage")
      .select("id, provider, model, tokens_in, tokens_out, latency_ms, cost_cents, status, created_at")
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    return { usage: data ?? [] };
  });

export const listAIMemory = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await (context.supabase as any)
      .from("ai_memory")
      .select("id, scope, key, value, confidence, source, is_pinned, created_at, updated_at")
      .order("scope", { ascending: true });
    if (error) throw new Error(error.message);
    return { memory: data ?? [] };
  });

// Metadata endpoint for the UI (no secrets).
export const getAICopilotMetadata = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => ({
    providers: AI_PROVIDERS,
    version: "P0.6-wave1",
    orchestratorEnabled: true,
  }));
