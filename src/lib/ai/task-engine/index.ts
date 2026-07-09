// FEATURE P0.6 — Onda 1 · Task Engine
// Generic task engine — used by AI in Wave 1; ready for SYNC/IMPORT/EXPORT/etc. later.
// Pure helpers here; DB writes happen in orchestrator via `requireSupabaseAuth`.

import type { TaskStatus, TaskType } from "../types";

export type TaskInput = {
  organizationId: string;
  userId: string | null;
  type: TaskType;
  category?: string;
  priority?: number;
  provider?: string | null;
  model?: string | null;
  payload?: Record<string, unknown>;
  context?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  conversationId?: string | null;
  parentTaskId?: string | null;
};

export type TaskRow = {
  id: string;
  organization_id: string;
  user_id: string | null;
  type: TaskType;
  category: string | null;
  status: TaskStatus;
  priority: number;
  provider: string | null;
  model: string | null;
  payload: Record<string, unknown>;
  context: Record<string, unknown>;
  result: Record<string, unknown> | null;
  metadata: Record<string, unknown>;
  tokens_in: number;
  tokens_out: number;
  estimated_cost_cents: number;
  duration_ms: number | null;
  error_code: string | null;
  error_message: string | null;
  started_at: string | null;
  finished_at: string | null;
  conversation_id: string | null;
  parent_task_id: string | null;
  created_at: string;
  updated_at: string;
};

export function isTerminal(status: TaskStatus): boolean {
  return status === "succeeded" || status === "failed" || status === "cancelled" || status === "timeout";
}

export function canTransition(from: TaskStatus, to: TaskStatus): boolean {
  if (from === to) return true;
  if (isTerminal(from)) return false;
  const graph: Record<TaskStatus, TaskStatus[]> = {
    queued: ["running", "cancelled"],
    running: ["succeeded", "failed", "cancelled", "timeout"],
    succeeded: [],
    failed: [],
    cancelled: [],
    timeout: [],
  };
  return graph[from]?.includes(to) ?? false;
}

export function buildTaskInsert(input: TaskInput) {
  const priority = clampPriority(input.priority);
  return {
    organization_id: input.organizationId,
    user_id: input.userId,
    type: input.type,
    category: input.category ?? null,
    status: "queued" as const,
    priority,
    provider: input.provider ?? null,
    model: input.model ?? null,
    payload: input.payload ?? {},
    context: input.context ?? {},
    metadata: input.metadata ?? {},
    conversation_id: input.conversationId ?? null,
    parent_task_id: input.parentTaskId ?? null,
  };
}

export function clampPriority(p: number | undefined): number {
  if (typeof p !== "number" || !Number.isFinite(p)) return 5;
  return Math.min(10, Math.max(1, Math.round(p)));
}

export function computeDurationMs(startedAt: string | null, finishedAt: string | null): number | null {
  if (!startedAt || !finishedAt) return null;
  const s = Date.parse(startedAt);
  const f = Date.parse(finishedAt);
  if (Number.isNaN(s) || Number.isNaN(f) || f < s) return null;
  return f - s;
}
