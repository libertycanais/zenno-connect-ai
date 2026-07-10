// EPIC J — Preferences · per-user, per-org UI preferences (in-memory)
import type { OrgScoped, UserPreferences } from "../types";

const now = (): string => new Date().toISOString();
const key = (org: string, user: string): string => `${org}::${user}`;

export class PreferencesStore {
  private store = new Map<string, UserPreferences>();

  get(o: OrgScoped, userId: string): UserPreferences | null {
    return this.store.get(key(o.organizationId, userId)) ?? null;
  }

  upsert(o: OrgScoped, userId: string, patch: Partial<UserPreferences>): UserPreferences {
    const prev = this.get(o, userId) ?? {
      organizationId: o.organizationId, userId, updatedAt: now(),
    } as UserPreferences;
    const next: UserPreferences = { ...prev, ...patch, organizationId: o.organizationId, userId, updatedAt: now() };
    this.store.set(key(o.organizationId, userId), next);
    return next;
  }
}
