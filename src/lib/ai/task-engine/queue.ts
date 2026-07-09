// EPIC F — In-memory Task Queue (additive).
// Fornece execução assíncrona, priorização, retry exponencial, agendamento,
// cancelamento e monitoramento. NÃO substitui `task-engine/index.ts` (DB-backed);
// é uma camada de runtime local para workers e edge functions.
//
// Contratos:
// - enqueue → gera taskId e devolve status inicial 'queued'
// - runNext → executa a próxima tarefa disponível (respeitando scheduledAt/priority)
// - cancel(id) → marca 'cancelled' antes/durante execução
// - stats() → snapshot para métricas/dashboard

export type QueueTaskStatus = "queued" | "running" | "succeeded" | "failed" | "cancelled" | "timeout";

export type EnqueueInput<T> = {
  handler: (payload: T, ctx: { signal: AbortSignal; attempt: number }) => Promise<unknown>;
  payload: T;
  priority?: number;         // 1 (alto) ... 10 (baixo). default 5
  maxRetries?: number;       // default 3
  baseDelayMs?: number;      // default 200ms (backoff exponencial)
  timeoutMs?: number;        // default 30s
  scheduledAt?: number;      // epoch ms; default agora
  dedupeKey?: string;        // opcional: se já existe queued/running com esta key, retorna o mesmo id
  metadata?: Record<string, unknown>;
};

export type QueueTask = {
  id: string;
  status: QueueTaskStatus;
  priority: number;
  attempts: number;
  maxRetries: number;
  scheduledAt: number;
  createdAt: number;
  startedAt: number | null;
  finishedAt: number | null;
  errorCode: string | null;
  dedupeKey: string | null;
  metadata: Record<string, unknown>;
};

type Internal<T> = QueueTask & {
  handler: EnqueueInput<T>["handler"];
  payload: T;
  baseDelayMs: number;
  timeoutMs: number;
  controller: AbortController;
};

let counter = 0;
function nextId(): string { counter += 1; return `qtsk_${Date.now().toString(36)}_${counter.toString(36)}`; }

export class InMemoryTaskQueue {
  private readonly tasks = new Map<string, Internal<unknown>>();

  enqueue<T>(input: EnqueueInput<T>): QueueTask {
    if (input.dedupeKey) {
      for (const t of this.tasks.values()) {
        if (t.dedupeKey === input.dedupeKey && (t.status === "queued" || t.status === "running")) {
          return snapshot(t);
        }
      }
    }
    const now = Date.now();
    const task: Internal<T> = {
      id: nextId(),
      status: "queued",
      priority: clamp(input.priority ?? 5, 1, 10),
      attempts: 0,
      maxRetries: Math.max(0, input.maxRetries ?? 3),
      scheduledAt: input.scheduledAt ?? now,
      createdAt: now,
      startedAt: null,
      finishedAt: null,
      errorCode: null,
      dedupeKey: input.dedupeKey ?? null,
      metadata: input.metadata ?? {},
      handler: input.handler,
      payload: input.payload,
      baseDelayMs: input.baseDelayMs ?? 200,
      timeoutMs: input.timeoutMs ?? 30_000,
      controller: new AbortController(),
    };
    this.tasks.set(task.id, task as Internal<unknown>);
    return snapshot(task);
  }

  cancel(id: string): boolean {
    const t = this.tasks.get(id);
    if (!t) return false;
    if (t.status === "succeeded" || t.status === "failed" || t.status === "cancelled" || t.status === "timeout") return false;
    t.status = "cancelled";
    t.finishedAt = Date.now();
    t.controller.abort();
    return true;
  }

  get(id: string): QueueTask | null {
    const t = this.tasks.get(id);
    return t ? snapshot(t) : null;
  }

  /** Executa a próxima tarefa elegível. Retorna null se nada elegível agora. */
  async runNext(now: number = Date.now()): Promise<QueueTask | null> {
    const candidates = Array.from(this.tasks.values())
      .filter((t) => t.status === "queued" && t.scheduledAt <= now)
      .sort((a, b) => a.priority - b.priority || a.scheduledAt - b.scheduledAt);
    const t = candidates[0];
    if (!t) return null;
    return this.executeOne(t);
  }

  private async executeOne<T>(t: Internal<T>): Promise<QueueTask> {
    t.status = "running";
    t.startedAt = Date.now();
    t.attempts += 1;
    const timer = setTimeout(() => t.controller.abort(new Error("task_timeout")), t.timeoutMs);
    try {
      await t.handler(t.payload, { signal: t.controller.signal, attempt: t.attempts });
      t.status = "succeeded";
      t.finishedAt = Date.now();
      return snapshot(t);
    } catch (err) {
      const aborted = t.controller.signal.aborted;
      const isTimeout = aborted && String((t.controller.signal as unknown as { reason?: unknown }).reason ?? "").includes("task_timeout");
      if (t.status === "cancelled") return snapshot(t);
      if (isTimeout) {
        t.status = "timeout";
        t.errorCode = "timeout";
        t.finishedAt = Date.now();
        return snapshot(t);
      }
      if (t.attempts <= t.maxRetries) {
        // Backoff exponencial: base * 2^(attempt-1), com jitter simples.
        const backoff = t.baseDelayMs * Math.pow(2, t.attempts - 1);
        t.status = "queued";
        t.scheduledAt = Date.now() + backoff;
        t.controller = new AbortController();
        return snapshot(t);
      }
      t.status = "failed";
      t.errorCode = safeErrCode(err);
      t.finishedAt = Date.now();
      return snapshot(t);
    } finally {
      clearTimeout(timer);
    }
  }

  stats(): { queued: number; running: number; succeeded: number; failed: number; cancelled: number; timeout: number; total: number } {
    const s = { queued: 0, running: 0, succeeded: 0, failed: 0, cancelled: 0, timeout: 0, total: 0 };
    for (const t of this.tasks.values()) { s[t.status] += 1; s.total += 1; }
    return s;
  }

  /** Limpa tarefas terminadas há mais de `olderThanMs`. */
  prune(olderThanMs = 60 * 60 * 1000, now: number = Date.now()): number {
    let n = 0;
    for (const [id, t] of this.tasks) {
      if (t.finishedAt && now - t.finishedAt > olderThanMs) { this.tasks.delete(id); n += 1; }
    }
    return n;
  }
}

function clamp(v: number, min: number, max: number): number { return Math.min(max, Math.max(min, Math.round(v))); }
function safeErrCode(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  return msg.slice(0, 120) || "unknown";
}
function snapshot<T>(t: Internal<T>): QueueTask {
  return {
    id: t.id, status: t.status, priority: t.priority, attempts: t.attempts,
    maxRetries: t.maxRetries, scheduledAt: t.scheduledAt, createdAt: t.createdAt,
    startedAt: t.startedAt, finishedAt: t.finishedAt, errorCode: t.errorCode,
    dedupeKey: t.dedupeKey, metadata: t.metadata,
  };
}

export const taskQueue = new InMemoryTaskQueue();
