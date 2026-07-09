// EPIC B — AI Execution Platform · Execution Scheduler
// Priority queue for workflows waiting to execute. Supports enqueue, cancel,
// resume, drain. No timers, no side effects. Consumer polls `next()`.

import type { Workflow } from "../contracts/workflow";

export type ScheduledEntry = {
  ticket: string;
  workflow: Workflow;
  priority: number;         // higher first
  enqueuedAt: string;
  status: "queued" | "running" | "cancelled" | "done" | "paused";
};

export class ExecutionScheduler {
  private queue: ScheduledEntry[] = [];
  private seq = 0;

  enqueue(workflow: Workflow, priority = 5): ScheduledEntry {
    const entry: ScheduledEntry = {
      ticket: `sch_${Date.now().toString(36)}_${(this.seq++).toString(36)}`,
      workflow, priority,
      enqueuedAt: new Date().toISOString(),
      status: "queued",
    };
    this.queue.push(entry);
    this.queue.sort((a, b) => b.priority - a.priority);
    return entry;
  }

  next(): ScheduledEntry | null {
    const entry = this.queue.find((e) => e.status === "queued");
    if (!entry) return null;
    entry.status = "running";
    return entry;
  }

  cancel(ticket: string): boolean {
    const e = this.queue.find((x) => x.ticket === ticket);
    if (!e || e.status === "done") return false;
    e.status = "cancelled";
    return true;
  }

  pause(ticket: string): boolean {
    const e = this.queue.find((x) => x.ticket === ticket);
    if (!e || e.status !== "running") return false;
    e.status = "paused";
    return true;
  }

  resume(ticket: string): boolean {
    const e = this.queue.find((x) => x.ticket === ticket);
    if (!e || e.status !== "paused") return false;
    e.status = "queued";
    this.queue.sort((a, b) => b.priority - a.priority);
    return true;
  }

  complete(ticket: string): void {
    const e = this.queue.find((x) => x.ticket === ticket);
    if (e) e.status = "done";
  }

  peek(): ScheduledEntry[] { return [...this.queue]; }
  size(): number { return this.queue.filter((e) => e.status === "queued").length; }
  clear(): void { this.queue = []; }
}

export const scheduler = new ExecutionScheduler();
