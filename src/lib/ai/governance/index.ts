// FEATURE P0.6 — Onda 5 · Governance module (extension points)
// Registries provided here are minimal, in-memory, deterministic. Real
// persistence lands with Onda 5+ (Brain / Rules / Artifact Store).

import type {
  RuleRegistry, RuleRecord, RuleRef,
  ContextSnapshot, ContextSnapshotStore,
  ArtifactLineageNode, ArtifactLineageStore,
  DecisionTrace, DecisionTraceStep,
  ConfidenceThresholdPolicy, ConfidenceEvaluation,
} from "./types";

export * from "./types";

// ── SHA-256 fingerprint (16 hex) — mirrors prompts/versioning.ts pattern ────
async function sha256_16(body: string): Promise<string> {
  const enc = new TextEncoder().encode(body);
  const buf = await crypto.subtle.digest("SHA-256", enc);
  const hex = Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
  return hex.slice(0, 16);
}

// ── In-memory RuleRegistry (reference implementation) ───────────────────────
export class InMemoryRuleRegistry implements RuleRegistry {
  private byKey = new Map<string, RuleRecord[]>();
  private activeIdx = new Map<string, number>();

  async register(key: string, version: string, body: string): Promise<RuleRecord> {
    const list = this.byKey.get(key) ?? [];
    if (list.some((r) => r.version === version)) {
      throw new Error(`Rule ${key}@${version} is immutable`);
    }
    const rec: RuleRecord = {
      key, version, body,
      fingerprint: await sha256_16(body),
      createdAt: new Date().toISOString(),
      active: list.length === 0,
    };
    list.push(rec);
    this.byKey.set(key, list);
    if (list.length === 1) this.activeIdx.set(key, 0);
    return rec;
  }

  activate(key: string, version: string): void {
    const list = this.byKey.get(key);
    if (!list) throw new Error(`Rule ${key} not found`);
    const i = list.findIndex((r) => r.version === version);
    if (i < 0) throw new Error(`Rule ${key}@${version} not registered`);
    list.forEach((r, idx) => { r.active = idx === i; });
    this.activeIdx.set(key, i);
  }

  active(key: string): RuleRecord | undefined {
    const list = this.byKey.get(key);
    const i = this.activeIdx.get(key);
    return list && i !== undefined ? list[i] : undefined;
  }

  history(key: string): RuleRecord[] {
    return [...(this.byKey.get(key) ?? [])];
  }

  ref(key: string): RuleRef | undefined {
    const a = this.active(key);
    return a ? { key: a.key, version: a.version, fingerprint: a.fingerprint } : undefined;
  }
}

export const ruleRegistry: RuleRegistry = new InMemoryRuleRegistry();

// ── In-memory Context Snapshot store ────────────────────────────────────────
export class InMemoryContextSnapshotStore implements ContextSnapshotStore {
  private data = new Map<string, { snapshot: ContextSnapshot; body: string }>();
  async put(snapshot: ContextSnapshot, body: string): Promise<void> {
    this.data.set(snapshot.snapshotId, { snapshot, body });
  }
  async get(id: string) { return this.data.get(id) ?? null; }
}

export const contextSnapshotStore: ContextSnapshotStore = new InMemoryContextSnapshotStore();

// ── In-memory Artifact Lineage store ────────────────────────────────────────
export class InMemoryArtifactLineageStore implements ArtifactLineageStore {
  private nodes = new Map<string, ArtifactLineageNode>();
  async record(node: ArtifactLineageNode): Promise<void> {
    this.nodes.set(node.artifact.artifactId, node);
  }
  async ancestors(id: string, depth = 5): Promise<ArtifactLineageNode[]> {
    const out: ArtifactLineageNode[] = [];
    const walk = (aid: string, d: number) => {
      if (d < 0) return;
      const n = this.nodes.get(aid);
      if (!n) return;
      out.push(n);
      for (const p of n.inputs) walk(p.artifactId, d - 1);
    };
    walk(id, depth);
    return out;
  }
  async descendants(id: string, depth = 5): Promise<ArtifactLineageNode[]> {
    const out: ArtifactLineageNode[] = [];
    const walk = (aid: string, d: number) => {
      if (d < 0) return;
      for (const n of this.nodes.values()) {
        if (n.inputs.some((i) => i.artifactId === aid)) {
          out.push(n);
          walk(n.artifact.artifactId, d - 1);
        }
      }
    };
    walk(id, depth);
    return out;
  }
}

export const artifactLineageStore: ArtifactLineageStore = new InMemoryArtifactLineageStore();

// ── DecisionTrace builder (deterministic, append-only) ──────────────────────
export class DecisionTraceBuilder {
  private trace: DecisionTrace;
  constructor(seed: Omit<DecisionTrace, "steps" | "finishedAt" | "outcome">) {
    this.trace = { ...seed, steps: [], finishedAt: null, outcome: "success" };
  }
  step(s: Omit<DecisionTraceStep, "at"> & { at?: string }): this {
    this.trace.steps.push({ ...s, at: s.at ?? new Date().toISOString() });
    return this;
  }
  finish(outcome: DecisionTrace["outcome"]): DecisionTrace {
    this.trace.finishedAt = new Date().toISOString();
    this.trace.outcome = outcome;
    return this.trace;
  }
  snapshot(): DecisionTrace { return { ...this.trace, steps: [...this.trace.steps] }; }
}

// ── Confidence Threshold evaluator (pure) ───────────────────────────────────
export function evaluateConfidence(
  confidence: number,
  policy: ConfidenceThresholdPolicy,
  ctx: { staleModules: number; hasSources: boolean },
): ConfidenceEvaluation {
  if (confidence < policy.minConfidence) {
    return { passed: false, confidence, policy, reason: `below-threshold:${policy.minConfidence}` };
  }
  if (policy.requireSources && !ctx.hasSources) {
    return { passed: false, confidence, policy, reason: "missing-sources" };
  }
  if (ctx.staleModules > policy.maxStaleModules) {
    return { passed: false, confidence, policy, reason: `too-stale:${ctx.staleModules}` };
  }
  return { passed: true, confidence, policy, reason: "ok" };
}

// ── Fingerprint helper (public — used by future Workflow Engine) ────────────
export async function fingerprint16(body: string): Promise<string> {
  return sha256_16(body);
}
