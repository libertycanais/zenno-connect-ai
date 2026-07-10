// EPIC H — Business DNA (org-scoped, additive, in-memory)
// Loaded automatically by Experts. Never crosses organizations.

export type MaturityLevel = "starter" | "growing" | "scaling" | "enterprise";
export type RiskProfile = "conservative" | "balanced" | "aggressive";

export type BusinessDNA = {
  organizationId: string;
  market: string;
  businessModel: string;
  avgTicketCents: number;
  marginPercent: number;               // 0..100
  objectives: string[];
  positioning: string;
  digitalMaturity: MaturityLevel;
  riskProfile: RiskProfile;
  priorityKpis: string[];
  products: string[];
  services: string[];
  audiences: string[];
  strategies: string[];
  preferences: Record<string, string>;
  communicationTone: "formal" | "friendly" | "technical" | "executive";
  restrictions: string[];
  history: string[];
  version: number;
  updatedAt: string;
};

export type DNAInput = Omit<BusinessDNA, "version" | "updatedAt">;

export class BusinessDNAStore {
  private byOrg = new Map<string, BusinessDNA>();

  upsert(input: DNAInput): BusinessDNA {
    const prev = this.byOrg.get(input.organizationId);
    const next: BusinessDNA = {
      ...input,
      version: (prev?.version ?? 0) + 1,
      updatedAt: new Date().toISOString(),
    };
    this.byOrg.set(input.organizationId, next);
    return next;
  }
  get(organizationId: string): BusinessDNA | null {
    return this.byOrg.get(organizationId) ?? null;
  }
  require(organizationId: string): BusinessDNA {
    const d = this.get(organizationId);
    if (!d) throw new Error(`BusinessDNA missing for ${organizationId}`);
    return d;
  }
}

export const businessDNAStore = new BusinessDNAStore();

/** Utility: derive DNA-scoped hints used by Experts. */
export function summarizeDNA(dna: BusinessDNA): string {
  return [
    `Market=${dna.market}`,
    `Model=${dna.businessModel}`,
    `Maturity=${dna.digitalMaturity}`,
    `Risk=${dna.riskProfile}`,
    `Objectives=${dna.objectives.slice(0, 3).join("|")}`,
  ].join(" · ");
}
