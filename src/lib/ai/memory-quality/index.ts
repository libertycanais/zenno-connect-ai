// EPIC H — Memory Quality (thin re-export + gate helpers)
export { MemoryScorer, MemoryQuality, type QualityScore } from "../memory-engine";
import { MemoryScorer, type QualityScore } from "../memory-engine";
import type { MemoryRecord } from "../memory-engine";

export const QualityGate = {
  isUsable(m: MemoryRecord, opts?: { threshold?: number }): { ok: boolean; score: QualityScore } {
    const score = MemoryScorer.score(m);
    return { ok: score.overallScore >= (opts?.threshold ?? 0.35), score };
  },
};
