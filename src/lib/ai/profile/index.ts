// EPIC H — Organization Profile (light-weight, org-scoped)
export type OrgProfile = {
  organizationId: string;
  name: string;
  industry: string | null;
  size: "solo" | "smb" | "mid" | "enterprise";
  language: string;
  createdAt: string;
};

export class OrgProfileStore {
  private byOrg = new Map<string, OrgProfile>();
  upsert(p: Omit<OrgProfile, "createdAt">): OrgProfile {
    const prev = this.byOrg.get(p.organizationId);
    const next: OrgProfile = { ...p, createdAt: prev?.createdAt ?? new Date().toISOString() };
    this.byOrg.set(p.organizationId, next);
    return next;
  }
  get(organizationId: string): OrgProfile | null { return this.byOrg.get(organizationId) ?? null; }
}
export const orgProfileStore = new OrgProfileStore();
