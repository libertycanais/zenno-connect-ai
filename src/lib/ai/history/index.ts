// EPIC H — Organization Decision History (append-only, org-scoped)
export type HistoryEntry = {
  entryId: string;
  organizationId: string;
  kind: "recommendation" | "playbook_run" | "decision" | "feedback" | "outcome";
  refId: string;
  summary: string;
  payload: Record<string, unknown>;
  at: string;
};

const id = () => `hst_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

export class HistoryStore {
  private log: HistoryEntry[] = [];
  append(e: Omit<HistoryEntry, "entryId" | "at">): HistoryEntry {
    const rec: HistoryEntry = { ...e, entryId: id(), at: new Date().toISOString() };
    this.log.push(rec);
    return rec;
  }
  list(organizationId: string): HistoryEntry[] {
    return this.log.filter((e) => e.organizationId === organizationId);
  }
}
export const historyStore = new HistoryStore();
