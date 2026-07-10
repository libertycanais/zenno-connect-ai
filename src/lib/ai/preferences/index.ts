// EPIC H — Organization Preferences (org-scoped)
export type OrgPreferences = {
  organizationId: string;
  tone: "formal" | "friendly" | "technical" | "executive";
  language: string;
  currency: string;
  timezone: string;
  reportingCadence: "daily" | "weekly" | "monthly";
  restrictions: string[];
  updatedAt: string;
};

export class PreferencesStore {
  private byOrg = new Map<string, OrgPreferences>();
  set(p: Omit<OrgPreferences, "updatedAt">): OrgPreferences {
    const next: OrgPreferences = { ...p, updatedAt: new Date().toISOString() };
    this.byOrg.set(p.organizationId, next);
    return next;
  }
  get(organizationId: string): OrgPreferences | null { return this.byOrg.get(organizationId) ?? null; }
}
export const preferencesStore = new PreferencesStore();
