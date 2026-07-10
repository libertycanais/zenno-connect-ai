// RC2 Operational Enhancements — Evidence-based backlog governance.
// Additive pure module. All inputs are numeric evidence; output is a
// deterministic priority score + bucket (P0..P3) used by the UI/API.

export interface BacklogEvidence {
  organizationsAffected: number;   // ≥ 0
  frequency: number;               // ≥ 0 events/incidents
  financialImpactCents: number;    // ≥ 0
  retentionImpact: number;         // 0..100
  operationalImpact: number;       // 0..100
  effortDays: number;              // > 0
}

export type PriorityBucket = "P0" | "P1" | "P2" | "P3";

export interface BacklogScore {
  score: number;               // 0..1000
  bucket: PriorityBucket;
  breakdown: {
    reach: number;             // 0..1
    frequency: number;         // 0..1
    financial: number;         // 0..1
    retention: number;         // 0..1
    operational: number;       // 0..1
    effortDivisor: number;     // 0.1..10
  };
  warnings: string[];
}

const clamp01 = (n: number): number => Math.max(0, Math.min(1, n));
const safeNum = (n: number): number => (Number.isFinite(n) && n >= 0 ? n : 0);

// Normalisers — chosen so realistic pilot signals span 0..1.
const normReach = (n: number)      => clamp01(safeNum(n) / 50);          // 50 orgs ⇒ full
const normFreq  = (n: number)      => clamp01(safeNum(n) / 500);         // 500 hits ⇒ full
const normFin   = (cents: number)  => clamp01(safeNum(cents) / 500_000_00); // R$500k ⇒ full
const normPct   = (n: number)      => clamp01(safeNum(n) / 100);

/** Compute deterministic priority score + bucket for a backlog item.
 *  Weights: reach 0.20 · freq 0.15 · financial 0.25 · retention 0.20 · ops 0.20.
 *  Effort divisor ∈ [0.5..3] applied after weighting to reward small/high-value work.
 *  Final score is 0..1000 to keep buckets legible. */
export function scoreBacklogItem(input: BacklogEvidence): BacklogScore {
  const warnings: string[] = [];
  if (!Number.isFinite(input.effortDays) || input.effortDays <= 0) {
    warnings.push("effort_days must be > 0; defaulting to 1");
  }
  const effort = Number.isFinite(input.effortDays) && input.effortDays > 0 ? input.effortDays : 1;
  const breakdown = {
    reach: normReach(input.organizationsAffected),
    frequency: normFreq(input.frequency),
    financial: normFin(input.financialImpactCents),
    retention: normPct(input.retentionImpact),
    operational: normPct(input.operationalImpact),
    effortDivisor: Math.max(0.5, Math.min(3, Math.log2(effort + 1))),
  };
  const weighted =
    0.20 * breakdown.reach +
    0.15 * breakdown.frequency +
    0.25 * breakdown.financial +
    0.20 * breakdown.retention +
    0.20 * breakdown.operational;
  const raw = (weighted / breakdown.effortDivisor) * 1000;
  const score = Math.round(Math.max(0, Math.min(1000, raw)) * 100) / 100;
  const bucket: PriorityBucket = score >= 650 ? "P0" : score >= 400 ? "P1" : score >= 200 ? "P2" : "P3";
  if (input.organizationsAffected === 0 && input.frequency === 0) {
    warnings.push("no reach or frequency evidence — bucket forced to P3");
  }
  return {
    score: warnings.includes("no reach or frequency evidence — bucket forced to P3") ? Math.min(score, 199.99) : score,
    bucket: warnings.includes("no reach or frequency evidence — bucket forced to P3") ? "P3" : bucket,
    breakdown, warnings,
  };
}

/** Rank a list of scored items by descending score; stable secondary sort by lowest effort. */
export function rankBacklog<T extends { score: BacklogScore; effortDays: number }>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    if (b.score.score !== a.score.score) return b.score.score - a.score.score;
    return a.effortDays - b.effortDays;
  });
}
