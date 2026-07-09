// EPIC F — Workflow Automation Triggers (additive).
// Motor de eventos in-memory que dispara workflows configurados sem alterar o
// WorkflowExecutor. Suporta 4 tipos de gatilho:
//   - "data.imported"     (importações concluídas)
//   - "metrics.updated"   (KPIs recalculados)
//   - "manual"            (disparo humano)
//   - "schedule"          (cron interno; caller decide a periodicidade)

export type TriggerKind = "data.imported" | "metrics.updated" | "manual" | "schedule";

export type TriggerEvent<P = Record<string, unknown>> = {
  kind: TriggerKind;
  organizationId: string;
  payload: P;
  emittedAt: number;
};

export type TriggerRule = {
  id: string;
  organizationId: string;
  kind: TriggerKind;
  match?: (evt: TriggerEvent) => boolean;
  handler: (evt: TriggerEvent) => Promise<void> | void;
  active: boolean;
};

export class AutomationRegistry {
  private readonly rules = new Map<string, TriggerRule>();

  register(rule: TriggerRule): void { this.rules.set(rule.id, rule); }
  unregister(id: string): boolean { return this.rules.delete(id); }
  list(): TriggerRule[] { return Array.from(this.rules.values()); }

  async emit(evt: TriggerEvent): Promise<{ matched: number; errors: number }> {
    let matched = 0; let errors = 0;
    for (const rule of this.rules.values()) {
      if (!rule.active) continue;
      if (rule.kind !== evt.kind) continue;
      if (rule.organizationId !== evt.organizationId) continue;
      if (rule.match && !rule.match(evt)) continue;
      matched += 1;
      try { await rule.handler(evt); }
      catch { errors += 1; }
    }
    return { matched, errors };
  }
}

export const automationRegistry = new AutomationRegistry();
