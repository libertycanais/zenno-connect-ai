// EPIC H — Learning Engine
// Learns from USER FEEDBACK, executed playbooks, KPI outcomes, approved
// decisions and observed results. NEVER learns from raw LLM output.

export type LearningSource =
  | "user_feedback" | "playbook_result" | "kpi_delta" | "decision_approved" | "outcome";

export type LearningSample = {
  sampleId: string;
  organizationId: string;
  source: LearningSource;
  entityKind: "recommendation" | "playbook" | "expert" | "rule" | "memory";
  entityId: string;
  score: number;                     // -1..1
  metadata: Record<string, unknown>;
  createdAt: string;
};

export type LearningInsight = {
  insightId: string;
  organizationId: string;
  entityKind: LearningSample["entityKind"];
  entityId: string;
  totalSamples: number;
  averageScore: number;
  successRate: number;
  updatedAt: string;
};

const id = (p: string) => `${p}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

export class FeedbackCollector {
  private samples: LearningSample[] = [];
  collect(input: Omit<LearningSample, "sampleId" | "createdAt">): LearningSample {
    const s: LearningSample = { ...input, sampleId: id("smp"), createdAt: new Date().toISOString() };
    this.samples.push(s);
    return s;
  }
  list(organizationId: string): LearningSample[] {
    return this.samples.filter((s) => s.organizationId === organizationId);
  }
}

export const FeedbackAnalyzer = {
  aggregate(samples: LearningSample[]): LearningInsight[] {
    const by = new Map<string, LearningSample[]>();
    for (const s of samples) {
      const k = `${s.organizationId}|${s.entityKind}|${s.entityId}`;
      const arr = by.get(k) ?? [];
      arr.push(s);
      by.set(k, arr);
    }
    return [...by.entries()].map(([k, arr]) => {
      const [organizationId, entityKind, entityId] = k.split("|") as [string, LearningSample["entityKind"], string];
      const avg = arr.reduce((a, b) => a + b.score, 0) / arr.length;
      const successRate = arr.filter((s) => s.score > 0).length / arr.length;
      return {
        insightId: id("ins"),
        organizationId, entityKind, entityId,
        totalSamples: arr.length,
        averageScore: avg,
        successRate,
        updatedAt: new Date().toISOString(),
      };
    });
  },
};

export const LearningScorer = {
  scoreEntity(insights: LearningInsight[], entityKind: LearningSample["entityKind"], entityId: string): number {
    const rel = insights.filter((i) => i.entityKind === entityKind && i.entityId === entityId);
    if (!rel.length) return 0;
    return rel.reduce((a, b) => a + b.averageScore, 0) / rel.length;
  },
};

export type LearningTimelineEntry = {
  entryId: string;
  organizationId: string;
  at: string;
  kind: "created" | "campaign" | "optimization" | "sale" | "strategy" | "playbook" | "benchmark" | "memory" | "kpi";
  title: string;
  payload: Record<string, unknown>;
};

export class LearningTimeline {
  private entries: LearningTimelineEntry[] = [];
  add(e: Omit<LearningTimelineEntry, "entryId" | "at">): LearningTimelineEntry {
    const rec: LearningTimelineEntry = { ...e, entryId: id("tle"), at: new Date().toISOString() };
    this.entries.push(rec);
    return rec;
  }
  list(organizationId: string): LearningTimelineEntry[] {
    return this.entries
      .filter((e) => e.organizationId === organizationId)
      .sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
  }
}

export type KnowledgeUpdate = {
  organizationId: string;
  ruleId?: string;
  playbookId?: string;
  memoryId?: string;
  action: "boost" | "demote" | "retire" | "flag";
  reason: string;
};

export const KnowledgeUpdater = {
  fromInsights(insights: LearningInsight[]): KnowledgeUpdate[] {
    return insights.map((i) => {
      if (i.successRate >= 0.75) {
        return { organizationId: i.organizationId, [`${i.entityKind}Id`]: i.entityId, action: "boost", reason: "high success rate" } as KnowledgeUpdate;
      }
      if (i.successRate <= 0.25) {
        return { organizationId: i.organizationId, [`${i.entityKind}Id`]: i.entityId, action: "retire", reason: "low success rate" } as KnowledgeUpdate;
      }
      return { organizationId: i.organizationId, [`${i.entityKind}Id`]: i.entityId, action: "flag", reason: "mixed signals" } as KnowledgeUpdate;
    });
  },
};

export type LearningMetrics = {
  totalSamples: number;
  bySource: Record<LearningSource, number>;
  avgScore: number;
};

export const LearningMetricsCalc = {
  compute(samples: LearningSample[]): LearningMetrics {
    const bySource = { user_feedback: 0, playbook_result: 0, kpi_delta: 0, decision_approved: 0, outcome: 0 } as Record<LearningSource, number>;
    let acc = 0;
    for (const s of samples) { bySource[s.source]++; acc += s.score; }
    return { totalSamples: samples.length, bySource, avgScore: samples.length ? acc / samples.length : 0 };
  },
};

export type LearningSession = {
  sessionId: string;
  organizationId: string;
  samples: LearningSample[];
  insights: LearningInsight[];
  updates: KnowledgeUpdate[];
  metrics: LearningMetrics;
  createdAt: string;
};

export class LearningPipeline {
  constructor(private collector = new FeedbackCollector()) {}
  collector_(): FeedbackCollector { return this.collector; }
  run(organizationId: string): LearningSession {
    const samples = this.collector.list(organizationId);
    const insights = FeedbackAnalyzer.aggregate(samples);
    const updates = KnowledgeUpdater.fromInsights(insights);
    const metrics = LearningMetricsCalc.compute(samples);
    return {
      sessionId: id("lsn"),
      organizationId, samples, insights, updates, metrics,
      createdAt: new Date().toISOString(),
    };
  }
}

export class LearningEngine {
  readonly pipeline = new LearningPipeline();
  readonly timeline = new LearningTimeline();
  collect = (s: Omit<LearningSample, "sampleId" | "createdAt">) => this.pipeline.collector_().collect(s);
  run = (organizationId: string): LearningSession => this.pipeline.run(organizationId);
}

export const LearningInsights = FeedbackAnalyzer;
