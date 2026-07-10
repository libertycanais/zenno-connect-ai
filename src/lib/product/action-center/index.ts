// EPIC J — ActionCenter · Governance-only orchestration (no auto-execution)
import type { ProductAction, ActionStatus, OrgScoped, ProductPriority } from "../types";

const now = (): string => new Date().toISOString();
const genId = (p: string): string => `${p}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

export type ActionCreateInput = Omit<ProductAction, "id" | "status" | "createdAt" | "updatedAt">;

export class ActionCenter {
  private byOrg = new Map<string, Map<string, ProductAction>>();

  private bucket(org: string): Map<string, ProductAction> {
    if (!this.byOrg.has(org)) this.byOrg.set(org, new Map());
    return this.byOrg.get(org)!;
  }

  create(input: ActionCreateInput): ProductAction {
    const action: ProductAction = {
      ...input,
      id: genId("act"),
      status: "suggested",
      createdAt: now(),
      updatedAt: now(),
    };
    this.bucket(input.organizationId).set(action.id, action);
    return action;
  }

  list(o: OrgScoped, filter?: { status?: ActionStatus; priority?: ProductPriority }): ProductAction[] {
    const items = [...this.bucket(o.organizationId).values()];
    return items.filter((a) => {
      if (filter?.status && a.status !== filter.status) return false;
      if (filter?.priority && a.priority !== filter.priority) return false;
      return true;
    }).sort((a, b) => a.priority - b.priority || b.estimatedGainCents - a.estimatedGainCents);
  }

  get(o: OrgScoped, id: string): ProductAction | null {
    return this.bucket(o.organizationId).get(id) ?? null;
  }

  transition(o: OrgScoped, id: string, next: ActionStatus, actorUserId?: string): ProductAction {
    const a = this.get(o, id);
    if (!a) throw new Error("action_not_found");
    assertValidTransition(a.status, next);
    const updated: ProductAction = {
      ...a,
      status: next,
      updatedAt: now(),
      approvedBy: next === "approved" ? actorUserId ?? a.approvedBy : a.approvedBy,
      approvedAt: next === "approved" ? now() : a.approvedAt,
      executedAt: next === "executed" ? now() : a.executedAt,
    };
    this.bucket(o.organizationId).set(id, updated);
    return updated;
  }

  /**
   * Guardrail: this Epic never auto-executes actions.
   * Callers must explicitly transition through approval, then to executed.
   */
  canAutoExecute(): false { return false; }
}

const ALLOWED: Record<ActionStatus, ActionStatus[]> = {
  suggested: ["pending_approval", "rejected", "cancelled"],
  pending_approval: ["approved", "rejected", "cancelled"],
  approved: ["scheduled", "in_progress", "cancelled"],
  rejected: [],
  scheduled: ["in_progress", "cancelled"],
  in_progress: ["executed", "failed", "cancelled"],
  executed: [],
  failed: ["scheduled", "cancelled"],
  cancelled: [],
};

function assertValidTransition(from: ActionStatus, to: ActionStatus): void {
  if (!ALLOWED[from].includes(to)) {
    throw new Error(`invalid_transition:${from}->${to}`);
  }
}
