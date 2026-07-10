// EPIC H — Self Knowledge Audit
import type { MemoryRecord } from "../memory-engine";

export type AuditFindingKind =
  | "redundant_memory" | "stale_benchmark" | "unused_rule"
  | "obsolete_playbook" | "inconsistent_knowledge" | "cold_memory";

export type AuditFinding = {
  kind: AuditFindingKind;
  organizationId: string;
  refIds: string[];
  reason: string;
  severity: "info" | "warn" | "critical";
};

export type AuditInput = {
  organizationId: string;
  memories: MemoryRecord[];
  ruleUsage: Record<string, number>;       // ruleId → count
  playbookUsage: Record<string, number>;   // playbookId → count
  benchmarks: Array<{ id: string; updatedAt: string }>;
  now?: number;
};

export const SelfKnowledgeAudit = {
  run(input: AuditInput): AuditFinding[] {
    const findings: AuditFinding[] = [];
    const now = input.now ?? Date.now();
    const orgMemories = input.memories.filter((m) => m.organizationId === input.organizationId);

    // Redundant memories (same title + same scope)
    const seen = new Map<string, string[]>();
    for (const m of orgMemories) {
      const key = `${m.scope}|${m.title.trim().toLowerCase()}`;
      const arr = seen.get(key) ?? [];
      arr.push(m.memoryId);
      seen.set(key, arr);
    }
    for (const [, ids] of seen) {
      if (ids.length > 1) {
        findings.push({ kind: "redundant_memory", organizationId: input.organizationId, refIds: ids, reason: "duplicate title within same scope", severity: "warn" });
      }
    }

    // Cold memories: never used and older than 30d
    for (const m of orgMemories) {
      const ageDays = (now - Date.parse(m.updatedAt)) / 86_400_000;
      if (m.usageCount === 0 && ageDays > 30) {
        findings.push({ kind: "cold_memory", organizationId: input.organizationId, refIds: [m.memoryId], reason: `unused for ${ageDays.toFixed(0)}d`, severity: "info" });
      }
    }

    // Unused rules
    for (const [ruleId, count] of Object.entries(input.ruleUsage)) {
      if (count === 0) {
        findings.push({ kind: "unused_rule", organizationId: input.organizationId, refIds: [ruleId], reason: "never triggered", severity: "info" });
      }
    }

    // Obsolete playbooks (usage < 1 in window)
    for (const [pbId, count] of Object.entries(input.playbookUsage)) {
      if (count === 0) {
        findings.push({ kind: "obsolete_playbook", organizationId: input.organizationId, refIds: [pbId], reason: "no runs", severity: "warn" });
      }
    }

    // Stale benchmarks: older than 180d
    for (const b of input.benchmarks) {
      const ageDays = (now - Date.parse(b.updatedAt)) / 86_400_000;
      if (ageDays > 180) {
        findings.push({ kind: "stale_benchmark", organizationId: input.organizationId, refIds: [b.id], reason: `updated ${ageDays.toFixed(0)}d ago`, severity: "warn" });
      }
    }

    return findings;
  },
};

// Knowledge Evolution Engine — detects obsolete/inefficient knowledge
export type EvolutionFinding = AuditFinding & { recommendedAction: "retire" | "review" | "refresh" };

export const KnowledgeEvolutionEngine = {
  evolve(findings: AuditFinding[]): EvolutionFinding[] {
    return findings.map((f) => ({
      ...f,
      recommendedAction: f.kind === "stale_benchmark" ? "refresh"
        : f.kind === "obsolete_playbook" ? "retire"
        : f.kind === "unused_rule" ? "review"
        : f.kind === "redundant_memory" ? "review"
        : "review",
    }));
  },
};
