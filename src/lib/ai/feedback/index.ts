// EPIC H — Expert Feedback Loop
export type ExpertFeedback = {
  feedbackId: string;
  organizationId: string;
  expertId: string;
  recommendationId: string | null;
  used: boolean;
  accepted: boolean;
  rejected: boolean;
  outcome: "improved" | "neutral" | "worse" | "unknown";
  timeToResultMs: number | null;
  financialImpactCents: number;
  userComment: string | null;
  at: string;
};

const gid = () => `fbk_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

export class ExpertFeedbackStore {
  private log: ExpertFeedback[] = [];
  record(f: Omit<ExpertFeedback, "feedbackId" | "at">): ExpertFeedback {
    const rec: ExpertFeedback = { ...f, feedbackId: gid(), at: new Date().toISOString() };
    this.log.push(rec);
    return rec;
  }
  listByOrg(organizationId: string): ExpertFeedback[] {
    return this.log.filter((f) => f.organizationId === organizationId);
  }
  listByExpert(organizationId: string, expertId: string): ExpertFeedback[] {
    return this.listByOrg(organizationId).filter((f) => f.expertId === expertId);
  }
}

export const expertFeedbackStore = new ExpertFeedbackStore();

// ── Expert Confidence Calibration ───────────────────────────────────────────
export type ExpertCalibration = {
  expertId: string;
  organizationId: string;
  predictions: number;
  hits: number;
  misses: number;
  rollingAccuracy: number;      // last N
  confidenceHistory: number[];  // cap 50
};

export class ExpertCalibrationTracker {
  private by = new Map<string, ExpertCalibration>();
  private key(org: string, expert: string): string { return `${org}|${expert}`; }

  record(organizationId: string, expertId: string, predictedConfidence: number, wasCorrect: boolean): ExpertCalibration {
    const k = this.key(organizationId, expertId);
    const prev = this.by.get(k) ?? {
      expertId, organizationId,
      predictions: 0, hits: 0, misses: 0, rollingAccuracy: 0,
      confidenceHistory: [],
    };
    const predictions = prev.predictions + 1;
    const hits = prev.hits + (wasCorrect ? 1 : 0);
    const misses = prev.misses + (wasCorrect ? 0 : 1);
    const history = [...prev.confidenceHistory.slice(-49), predictedConfidence];
    const rollingAccuracy = hits / predictions;
    const next: ExpertCalibration = { expertId, organizationId, predictions, hits, misses, rollingAccuracy, confidenceHistory: history };
    this.by.set(k, next);
    return next;
  }
  get(organizationId: string, expertId: string): ExpertCalibration | null {
    return this.by.get(this.key(organizationId, expertId)) ?? null;
  }
  listByOrg(organizationId: string): ExpertCalibration[] {
    return [...this.by.values()].filter((c) => c.organizationId === organizationId);
  }
}

export const expertCalibrationTracker = new ExpertCalibrationTracker();
