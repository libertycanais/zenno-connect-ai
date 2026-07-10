// EPIC I — Scenario Engine (What-if analysis, pure, deterministic)
export type ScenarioInput = {
  organizationId: string;
  name: string;
  baseline: Record<string, number>;   // metric -> current value
  changes: Record<string, number>;    // metric -> delta pct (e.g. 0.2 = +20%)
};

export type ScenarioOutput = {
  organizationId: string;
  name: string;
  baseline: Record<string, number>;
  projected: Record<string, number>;
  deltas: Record<string, number>;
  netImpact: number;
  generatedAt: string;
};

export function runScenario(input: ScenarioInput): ScenarioOutput {
  const projected: Record<string, number> = {};
  const deltas: Record<string, number> = {};
  let net = 0;
  for (const [k, v] of Object.entries(input.baseline)) {
    const change = input.changes[k] ?? 0;
    const next = v * (1 + change);
    projected[k] = next;
    deltas[k] = next - v;
    net += next - v;
  }
  return {
    organizationId: input.organizationId,
    name: input.name,
    baseline: input.baseline,
    projected,
    deltas,
    netImpact: net,
    generatedAt: new Date().toISOString(),
  };
}

export const canonicalScenarios = {
  increaseBudgetBy(pct: number): Partial<ScenarioInput["changes"]> { return { spend: pct, revenue: pct * 0.8 }; },
  reduceCacBy(pct: number): Partial<ScenarioInput["changes"]> { return { cac: -pct, newCustomers: pct * 0.5 }; },
  increaseConversionBy(pct: number): Partial<ScenarioInput["changes"]> { return { conversionRate: pct, revenue: pct * 0.9 }; },
};
