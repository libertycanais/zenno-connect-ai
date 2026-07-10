// EPIC H — Organizational Memory & Learning Engine
// 100% additive, in-memory, organization-scoped. No provider access. No I/O.
// Ready for future RAG / Vector Search adapters via embeddingRef contract.

export type MemoryScope =
  | "org" | "campaign" | "customer" | "sales" | "marketing"
  | "seo" | "finance" | "executive" | "tracking"
  | "playbook" | "workflow" | "decision" | "expert";

export type MemoryCategory =
  | "insight" | "fact" | "preference" | "restriction"
  | "outcome" | "benchmark" | "strategy" | "lesson";

export type EmbeddingRef = {
  provider: string;              // e.g. "none" | "openai" | "gemini"
  version: string;
  vectorId: string | null;       // filled by future vector DB adapter
  dims: number | null;
};

export type KnowledgeLineageRef = {
  signalIds: string[];
  kpiIds: string[];
  ruleIds: string[];
  expertIds: string[];
  playbookIds: string[];
  decisionIds: string[];
};

export type MemoryRecord = {
  memoryId: string;
  organizationId: string;
  scope: MemoryScope;
  category: MemoryCategory;
  title: string;
  summary: string;
  content: Record<string, unknown>;
  confidence: number;            // 0..1
  importance: number;            // 0..1
  freshness: number;             // 0..1
  version: number;
  createdAt: string;
  updatedAt: string;
  expiresAt: string | null;
  source: string;
  tags: string[];
  embeddingRef: EmbeddingRef;
  embeddingVersion: string;
  vectorProvider: string;
  retrievalMetadata: Record<string, unknown>;
  knowledgeLineage: KnowledgeLineageRef;
  usageCount: number;
  feedbackScore: number;         // -1..1
  successRate: number;           // 0..1
  archived: boolean;
};

export type MemoryInput = Omit<MemoryRecord,
  "memoryId" | "version" | "createdAt" | "updatedAt" | "usageCount" |
  "feedbackScore" | "successRate" | "archived" | "freshness"
> & { freshness?: number };

const genId = (p: string) => `${p}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

// ── Builder ─────────────────────────────────────────────────────────────────
export const MemoryBuilder = {
  build(input: MemoryInput): MemoryRecord {
    const now = new Date().toISOString();
    return {
      memoryId: genId("mem"),
      organizationId: input.organizationId,
      scope: input.scope,
      category: input.category,
      title: input.title,
      summary: input.summary,
      content: input.content,
      confidence: clamp01(input.confidence),
      importance: clamp01(input.importance),
      freshness: clamp01(input.freshness ?? 1),
      version: 1,
      createdAt: now,
      updatedAt: now,
      expiresAt: input.expiresAt,
      source: input.source,
      tags: [...new Set(input.tags)],
      embeddingRef: input.embeddingRef,
      embeddingVersion: input.embeddingVersion,
      vectorProvider: input.vectorProvider,
      retrievalMetadata: input.retrievalMetadata,
      knowledgeLineage: input.knowledgeLineage,
      usageCount: 0,
      feedbackScore: 0,
      successRate: 0,
      archived: false,
    };
  },
};

// ── Validator ───────────────────────────────────────────────────────────────
export const MemoryValidator = {
  validate(m: MemoryRecord): { ok: true } | { ok: false; error: string } {
    if (!m.organizationId) return { ok: false, error: "organizationId required" };
    if (!m.title || m.title.length > 200) return { ok: false, error: "title required (<=200)" };
    if (m.confidence < 0 || m.confidence > 1) return { ok: false, error: "confidence out of range" };
    if (m.importance < 0 || m.importance > 1) return { ok: false, error: "importance out of range" };
    return { ok: true };
  },
};

// ── Versioning ──────────────────────────────────────────────────────────────
export const MemoryVersioning = {
  bump(prev: MemoryRecord, patch: Partial<MemoryRecord>): MemoryRecord {
    return {
      ...prev,
      ...patch,
      memoryId: prev.memoryId,
      organizationId: prev.organizationId,
      version: prev.version + 1,
      createdAt: prev.createdAt,
      updatedAt: new Date().toISOString(),
    };
  },
};

// ── Merger ──────────────────────────────────────────────────────────────────
export const MemoryMerger = {
  merge(a: MemoryRecord, b: MemoryRecord): MemoryRecord {
    if (a.organizationId !== b.organizationId) {
      throw new Error("cross-tenant memory merge is forbidden");
    }
    return MemoryVersioning.bump(a, {
      summary: pickLonger(a.summary, b.summary),
      content: { ...a.content, ...b.content },
      confidence: Math.max(a.confidence, b.confidence),
      importance: Math.max(a.importance, b.importance),
      freshness: Math.max(a.freshness, b.freshness),
      tags: [...new Set([...a.tags, ...b.tags])],
      knowledgeLineage: mergeLineage(a.knowledgeLineage, b.knowledgeLineage),
      usageCount: a.usageCount + b.usageCount,
    });
  },
};

// ── Decay ───────────────────────────────────────────────────────────────────
export type DecayPolicy = {
  halfLifeDays: number;
  archiveBelow: number;      // freshness threshold
  removeBelow: number;
};

export const MemoryDecay = {
  apply(m: MemoryRecord, nowMs: number, policy: DecayPolicy): MemoryRecord {
    const ageDays = (nowMs - new Date(m.updatedAt).getTime()) / 86_400_000;
    const decay = Math.pow(0.5, ageDays / Math.max(0.5, policy.halfLifeDays));
    const freshness = clamp01(m.freshness * decay);
    return { ...m, freshness, archived: m.archived || freshness < policy.archiveBelow };
  },
  shouldRemove(m: MemoryRecord, policy: DecayPolicy): boolean {
    if (m.expiresAt && Date.parse(m.expiresAt) < Date.now()) return true;
    return m.freshness < policy.removeBelow;
  },
};

// ── Quality Scorer ──────────────────────────────────────────────────────────
export type QualityScore = {
  confidence: number; relevance: number; freshness: number;
  businessImpact: number; feedbackScore: number; usageCount: number;
  successRate: number; decayScore: number; overallScore: number;
};

export const MemoryScorer = {
  score(m: MemoryRecord, opts?: { relevance?: number; businessImpact?: number }): QualityScore {
    const relevance = clamp01(opts?.relevance ?? 0.5);
    const businessImpact = clamp01(opts?.businessImpact ?? m.importance);
    const feedback = (m.feedbackScore + 1) / 2; // -1..1 → 0..1
    const usage = 1 - Math.exp(-m.usageCount / 20);
    const decayScore = m.freshness;
    const overallScore = clamp01(
      0.20 * m.confidence + 0.18 * relevance + 0.15 * decayScore +
      0.15 * businessImpact + 0.10 * feedback + 0.10 * usage +
      0.12 * m.successRate,
    );
    return {
      confidence: m.confidence, relevance, freshness: m.freshness,
      businessImpact, feedbackScore: feedback, usageCount: usage,
      successRate: m.successRate, decayScore, overallScore,
    };
  },
};

// ── Search contracts (Semantic/Keyword/Hybrid/Temporal/Tag/Importance/Vector) ─
export type SearchQuery = {
  organizationId: string;
  text?: string;
  tags?: string[];
  scope?: MemoryScope;
  category?: MemoryCategory;
  minImportance?: number;
  minConfidence?: number;
  fromDate?: string;
  toDate?: string;
  limit?: number;
};

export type SearchMode = "semantic" | "keyword" | "hybrid" | "temporal" | "tag" | "importance" | "vector";

export type SearchHit = { record: MemoryRecord; score: number; mode: SearchMode };

export const MemorySearch = {
  keyword(q: SearchQuery, all: MemoryRecord[]): SearchHit[] {
    const scoped = tenantScope(all, q.organizationId).filter(filterBy(q));
    const term = (q.text ?? "").toLowerCase();
    return scoped
      .map((r) => ({
        record: r,
        score: term ? overlapScore(r, term) : r.importance,
        mode: "keyword" as const,
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, q.limit ?? 20);
  },
  tag(q: SearchQuery, all: MemoryRecord[]): SearchHit[] {
    const tags = new Set(q.tags ?? []);
    return tenantScope(all, q.organizationId)
      .filter(filterBy(q))
      .filter((r) => r.tags.some((t) => tags.has(t)))
      .map((r) => ({ record: r, score: r.importance, mode: "tag" as const }))
      .slice(0, q.limit ?? 20);
  },
  temporal(q: SearchQuery, all: MemoryRecord[]): SearchHit[] {
    return tenantScope(all, q.organizationId)
      .filter(filterBy(q))
      .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))
      .slice(0, q.limit ?? 20)
      .map((r) => ({ record: r, score: r.freshness, mode: "temporal" as const }));
  },
  importance(q: SearchQuery, all: MemoryRecord[]): SearchHit[] {
    return tenantScope(all, q.organizationId)
      .filter(filterBy(q))
      .sort((a, b) => b.importance - a.importance)
      .slice(0, q.limit ?? 20)
      .map((r) => ({ record: r, score: r.importance, mode: "importance" as const }));
  },
  hybrid(q: SearchQuery, all: MemoryRecord[]): SearchHit[] {
    const kw = new Map(this.keyword(q, all).map((h) => [h.record.memoryId, h.score]));
    const tp = new Map(this.temporal(q, all).map((h) => [h.record.memoryId, h.score]));
    const scoped = tenantScope(all, q.organizationId).filter(filterBy(q));
    return scoped
      .map((r) => ({
        record: r,
        score: 0.6 * (kw.get(r.memoryId) ?? 0) + 0.4 * (tp.get(r.memoryId) ?? 0),
        mode: "hybrid" as const,
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, q.limit ?? 20);
  },
  // vector/semantic contracts — future adapters plug in here.
  vector(_q: SearchQuery, _all: MemoryRecord[]): SearchHit[] { return []; },
  semantic(_q: SearchQuery, _all: MemoryRecord[]): SearchHit[] { return []; },
};

// ── Indexer + Retriever + Pruner + Replay ───────────────────────────────────
export const MemoryIndexer = {
  index(records: MemoryRecord[]): Map<string, MemoryRecord[]> {
    const byOrg = new Map<string, MemoryRecord[]>();
    for (const r of records) {
      const arr = byOrg.get(r.organizationId) ?? [];
      arr.push(r);
      byOrg.set(r.organizationId, arr);
    }
    return byOrg;
  },
};

export const MemoryRetriever = {
  top(q: SearchQuery, all: MemoryRecord[], mode: SearchMode = "hybrid"): MemoryRecord[] {
    const hits = (MemorySearch as unknown as Record<string, (q: SearchQuery, a: MemoryRecord[]) => SearchHit[]>)[mode](q, all);
    return hits.map((h) => h.record);
  },
};

export const MemoryPruner = {
  prune(records: MemoryRecord[], policy: DecayPolicy, nowMs = Date.now()): MemoryRecord[] {
    return records
      .map((r) => MemoryDecay.apply(r, nowMs, policy))
      .filter((r) => !MemoryDecay.shouldRemove(r, policy));
  },
};

export const MemoryReplay = {
  snapshot(records: MemoryRecord[], organizationId: string, atIso: string): MemoryRecord[] {
    const t = Date.parse(atIso);
    return records.filter(
      (r) => r.organizationId === organizationId && Date.parse(r.createdAt) <= t,
    );
  },
};

// ── Engine facade ───────────────────────────────────────────────────────────
export class MemoryEngine {
  private store = new Map<string, MemoryRecord>();

  put(input: MemoryInput): MemoryRecord {
    const rec = MemoryBuilder.build(input);
    const v = MemoryValidator.validate(rec);
    if (!v.ok) throw new Error(v.error);
    this.store.set(rec.memoryId, rec);
    return rec;
  }
  get(id: string, organizationId: string): MemoryRecord | null {
    const r = this.store.get(id);
    if (!r || r.organizationId !== organizationId) return null;
    return r;
  }
  update(id: string, organizationId: string, patch: Partial<MemoryRecord>): MemoryRecord {
    const prev = this.get(id, organizationId);
    if (!prev) throw new Error("memory not found or cross-tenant");
    const next = MemoryVersioning.bump(prev, patch);
    this.store.set(id, next);
    return next;
  }
  list(organizationId: string): MemoryRecord[] {
    return [...this.store.values()].filter((r) => r.organizationId === organizationId);
  }
  markUsed(id: string, organizationId: string, outcome?: { success?: boolean; feedback?: number }): MemoryRecord {
    const r = this.get(id, organizationId);
    if (!r) throw new Error("memory not found or cross-tenant");
    const usageCount = r.usageCount + 1;
    const successRate = outcome?.success == null
      ? r.successRate
      : ((r.successRate * r.usageCount) + (outcome.success ? 1 : 0)) / usageCount;
    const feedbackScore = outcome?.feedback == null
      ? r.feedbackScore
      : Math.max(-1, Math.min(1, (r.feedbackScore + outcome.feedback) / 2));
    return this.update(id, organizationId, { usageCount, successRate, feedbackScore });
  }
  search(q: SearchQuery, mode: SearchMode = "hybrid"): SearchHit[] {
    return (MemorySearch as unknown as Record<string, (q: SearchQuery, a: MemoryRecord[]) => SearchHit[]>)[mode](q, this.list(q.organizationId));
  }
  prune(organizationId: string, policy: DecayPolicy): MemoryRecord[] {
    const pruned = MemoryPruner.prune(this.list(organizationId), policy);
    const keep = new Set(pruned.map((r) => r.memoryId));
    for (const r of this.list(organizationId)) {
      if (!keep.has(r.memoryId)) this.store.delete(r.memoryId);
    }
    for (const r of pruned) this.store.set(r.memoryId, r);
    return pruned;
  }
  replay(organizationId: string, atIso: string): MemoryRecord[] {
    return MemoryReplay.snapshot(this.list(organizationId), organizationId, atIso);
  }
}

export const MemoryQuality = MemoryScorer;

// ── helpers ─────────────────────────────────────────────────────────────────
function clamp01(n: number): number { return Math.max(0, Math.min(1, n)); }
function pickLonger(a: string, b: string): string { return a.length >= b.length ? a : b; }
function tenantScope<T extends { organizationId: string }>(rs: T[], org: string): T[] {
  return rs.filter((r) => r.organizationId === org);
}
function filterBy(q: SearchQuery) {
  return (r: MemoryRecord) => {
    if (q.scope && r.scope !== q.scope) return false;
    if (q.category && r.category !== q.category) return false;
    if (q.minImportance != null && r.importance < q.minImportance) return false;
    if (q.minConfidence != null && r.confidence < q.minConfidence) return false;
    if (q.fromDate && Date.parse(r.updatedAt) < Date.parse(q.fromDate)) return false;
    if (q.toDate && Date.parse(r.updatedAt) > Date.parse(q.toDate)) return false;
    if (r.archived) return false;
    return true;
  };
}
function overlapScore(r: MemoryRecord, term: string): number {
  const hay = `${r.title} ${r.summary} ${r.tags.join(" ")}`.toLowerCase();
  const tokens = term.split(/\s+/).filter(Boolean);
  if (!tokens.length) return 0;
  const hits = tokens.filter((t) => hay.includes(t)).length;
  return (hits / tokens.length) * (0.5 + 0.5 * r.importance);
}
function mergeLineage(a: KnowledgeLineageRef, b: KnowledgeLineageRef): KnowledgeLineageRef {
  const u = (x: string[], y: string[]) => [...new Set([...x, ...y])];
  return {
    signalIds: u(a.signalIds, b.signalIds),
    kpiIds: u(a.kpiIds, b.kpiIds),
    ruleIds: u(a.ruleIds, b.ruleIds),
    expertIds: u(a.expertIds, b.expertIds),
    playbookIds: u(a.playbookIds, b.playbookIds),
    decisionIds: u(a.decisionIds, b.decisionIds),
  };
}

export const emptyLineage = (): KnowledgeLineageRef => ({
  signalIds: [], kpiIds: [], ruleIds: [], expertIds: [], playbookIds: [], decisionIds: [],
});

export const noEmbedding = (): EmbeddingRef => ({
  provider: "none", version: "v0", vectorId: null, dims: null,
});
