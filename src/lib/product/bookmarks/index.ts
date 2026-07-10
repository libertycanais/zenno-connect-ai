// EPIC J — Bookmarks · per-user pinned references
import type { Bookmark, OrgScoped } from "../types";

const now = (): string => new Date().toISOString();
const genId = (p: string): string => `${p}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

export class BookmarkStore {
  private byOrg = new Map<string, Bookmark[]>();

  add(input: Omit<Bookmark, "id" | "createdAt">): Bookmark {
    const b: Bookmark = { ...input, id: genId("bm"), createdAt: now() };
    const list = this.byOrg.get(input.organizationId) ?? [];
    list.unshift(b);
    this.byOrg.set(input.organizationId, list);
    return b;
  }

  remove(o: OrgScoped, id: string): boolean {
    const list = this.byOrg.get(o.organizationId) ?? [];
    const next = list.filter((b) => b.id !== id);
    this.byOrg.set(o.organizationId, next);
    return next.length !== list.length;
  }

  listForUser(o: OrgScoped, userId: string): Bookmark[] {
    return (this.byOrg.get(o.organizationId) ?? []).filter((b) => b.userId === userId);
  }
}
