// EPIC A — Zenno Brain · AI Timeline
// Append-only, per-task chronological record. In-memory reference store;
// persistence lands in a future Epic. No provider calls.

import type { TimelineEntry, TimelineStage, TimelineWrite } from "../contracts/timeline";

export * from "../contracts/timeline";

function nextEntryId(): string {
  return `tl_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

export class TimelineStore {
  private byTask = new Map<string, TimelineEntry[]>();

  append(entry: TimelineWrite): TimelineEntry {
    const full: TimelineEntry = {
      ...entry,
      entryId: nextEntryId(),
      timestamp: new Date().toISOString(),
    };
    const list = this.byTask.get(entry.taskId) ?? [];
    list.push(full);
    this.byTask.set(entry.taskId, list);
    return full;
  }

  forTask(taskId: string): TimelineEntry[] {
    return [...(this.byTask.get(taskId) ?? [])];
  }

  forOrganization(organizationId: string): TimelineEntry[] {
    const out: TimelineEntry[] = [];
    for (const entries of this.byTask.values()) {
      for (const e of entries) if (e.organizationId === organizationId) out.push(e);
    }
    return out.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  }

  latestStage(taskId: string): TimelineStage | null {
    const list = this.byTask.get(taskId);
    return list && list.length ? list[list.length - 1].stage : null;
  }

  clear(): void { this.byTask.clear(); }
  size(): number {
    let n = 0; for (const l of this.byTask.values()) n += l.length; return n;
  }
}

export const timeline = new TimelineStore();
