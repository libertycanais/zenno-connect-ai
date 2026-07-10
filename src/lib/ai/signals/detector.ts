// Built-in detectors (pure, deterministic, threshold-based).
import type { SignalDetector, SignalDetectorInput } from "./types";

function pctDelta(cur: number | null | undefined, base: number | null | undefined): number | null {
  if (cur === null || cur === undefined || base === null || base === undefined || base === 0) return null;
  return (cur - base) / Math.abs(base);
}

function kpiDropDetector(opts: {
  id: string; type: SignalDetector["type"]; domain: SignalDetector["domain"];
  kpi: string; dropThreshold: number; experts: SignalDetector["detect"] extends never ? never : any;
  playbookHint?: string;
}): SignalDetector {
  return {
    id: opts.id, type: opts.type, domain: opts.domain, cadence: "daily",
    detect(input: SignalDetectorInput) {
      const cur = input.kpis?.[opts.kpi] ?? null;
      const base = input.baseline?.[opts.kpi] ?? null;
      const delta = pctDelta(cur, base);
      if (delta === null || delta > -Math.abs(opts.dropThreshold)) return null;
      const magnitude = Math.min(1, Math.abs(delta) / (Math.abs(opts.dropThreshold) * 2));
      const score = Math.round(50 + magnitude * 50);
      return {
        type: opts.type, domain: opts.domain, organizationId: input.organizationId,
        severity: undefined as never, priority: undefined as never,
        score, confidence: 0.7,
        source: { origin: "kpi" as const, ref: opts.kpi, detectorId: opts.id },
        evidence: [{ kind: "kpi" as const, key: opts.kpi, value: cur, baseline: base, delta, window: "7d" }],
        recommendedExperts: opts.experts,
        playbookHint: opts.playbookHint,
      };
    },
  };
}

function kpiIncreaseDetector(opts: {
  id: string; type: SignalDetector["type"]; domain: SignalDetector["domain"];
  kpi: string; increaseThreshold: number; experts: any;
}): SignalDetector {
  return {
    id: opts.id, type: opts.type, domain: opts.domain, cadence: "daily",
    detect(input) {
      const cur = input.kpis?.[opts.kpi] ?? null;
      const base = input.baseline?.[opts.kpi] ?? null;
      const delta = pctDelta(cur, base);
      if (delta === null || delta < Math.abs(opts.increaseThreshold)) return null;
      const magnitude = Math.min(1, delta / (opts.increaseThreshold * 2));
      const score = Math.round(45 + magnitude * 55);
      return {
        type: opts.type, domain: opts.domain, organizationId: input.organizationId,
        severity: undefined as never, priority: undefined as never,
        score, confidence: 0.65,
        source: { origin: "kpi", ref: opts.kpi, detectorId: opts.id },
        evidence: [{ kind: "kpi", key: opts.kpi, value: cur, baseline: base, delta, window: "7d" }],
        recommendedExperts: opts.experts,
      };
    },
  };
}

export const builtInDetectors: SignalDetector[] = [
  kpiDropDetector({ id: "det.roas.drop", type: "ROASDrop", domain: "marketing", kpi: "roas", dropThreshold: 0.15, experts: ["marketing", "finance", "executive"], playbookHint: "roas-recovery" }),
  kpiDropDetector({ id: "det.ctr.drop", type: "CTRDrop", domain: "marketing", kpi: "ctr", dropThreshold: 0.2, experts: ["marketing", "cro"] }),
  kpiIncreaseDetector({ id: "det.cpa.up", type: "CPAIncrease", domain: "marketing", kpi: "cpa", increaseThreshold: 0.2, experts: ["marketing", "finance"] }),
  kpiDropDetector({ id: "det.conv.drop", type: "ConversionDrop", domain: "marketing", kpi: "conversionRate", dropThreshold: 0.15, experts: ["marketing", "cro"] }),
  kpiDropDetector({ id: "det.organic.drop", type: "OrganicTrafficDrop", domain: "seo", kpi: "organicTraffic", dropThreshold: 0.15, experts: ["seo", "growth"] }),
  kpiDropDetector({ id: "det.leads.drop", type: "LeadDrop", domain: "crm", kpi: "leads", dropThreshold: 0.2, experts: ["crm", "marketing"] }),
  kpiIncreaseDetector({ id: "det.leads.up", type: "LeadGrowth", domain: "crm", kpi: "leads", increaseThreshold: 0.3, experts: ["crm", "growth"] }),
  kpiDropDetector({ id: "det.mrr.drop", type: "MRRDrop", domain: "sales", kpi: "mrr", dropThreshold: 0.05, experts: ["sales", "executive", "finance"] }),
  kpiIncreaseDetector({ id: "det.churn.up", type: "ChurnIncrease", domain: "sales", kpi: "churn", increaseThreshold: 0.15, experts: ["customer-success", "executive"] }),
  kpiIncreaseDetector({ id: "det.cost.up", type: "CostIncrease", domain: "finance", kpi: "cost", increaseThreshold: 0.2, experts: ["finance", "executive"] }),
  kpiDropDetector({ id: "det.margin.drop", type: "MarginDrop", domain: "finance", kpi: "margin", dropThreshold: 0.1, experts: ["finance", "executive"] }),
  kpiDropDetector({ id: "det.health.drop", type: "BusinessHealthDrop", domain: "executive", kpi: "healthScore", dropThreshold: 0.1, experts: ["executive"] }),
];
