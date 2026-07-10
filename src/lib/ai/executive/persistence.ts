// EPIC I — Executive Persistence contracts + in-memory store
import type { ExecutiveReport } from "./types";

export interface ExecutiveReportStore {
  save(report: ExecutiveReport): Promise<void>;
  get(reportId: string): Promise<ExecutiveReport | null>;
  listByOrganization(organizationId: string, limit?: number): Promise<ExecutiveReport[]>;
  latest(organizationId: string): Promise<ExecutiveReport | null>;
}

export class InMemoryExecutiveReportStore implements ExecutiveReportStore {
  private byId = new Map<string, ExecutiveReport>();
  private byOrg = new Map<string, string[]>();

  async save(r: ExecutiveReport): Promise<void> {
    this.byId.set(r.reportId, r);
    const list = this.byOrg.get(r.organizationId) ?? [];
    list.unshift(r.reportId);
    this.byOrg.set(r.organizationId, list);
  }
  async get(id: string): Promise<ExecutiveReport | null> { return this.byId.get(id) ?? null; }
  async listByOrganization(orgId: string, limit = 50): Promise<ExecutiveReport[]> {
    const ids = (this.byOrg.get(orgId) ?? []).slice(0, limit);
    return ids.map((id) => this.byId.get(id)!).filter(Boolean);
  }
  async latest(orgId: string): Promise<ExecutiveReport | null> {
    const id = (this.byOrg.get(orgId) ?? [])[0];
    return id ? this.byId.get(id) ?? null : null;
  }
}
