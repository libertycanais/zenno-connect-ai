// FEATURE P0.6 — Onda 1 · AI Memory (structural)
// Schema-level helpers only. Reads/writes happen through orchestrator via RLS.

export const MEMORY_SCOPES = [
  "objectives",
  "products",
  "competitors",
  "preferences",
  "restrictions",
  "campaigns",
  "history",
  "insights",
  "custom",
] as const;
export type MemoryScope = (typeof MEMORY_SCOPES)[number];

export type MemoryEntry = {
  scope: MemoryScope;
  key: string;
  value: Record<string, unknown>;
  confidence?: number | null;
  source?: string | null;
  is_pinned?: boolean;
};

export function isValidScope(s: string): s is MemoryScope {
  return (MEMORY_SCOPES as readonly string[]).includes(s);
}

/** Basic entry validator used before DB write in Wave 2. */
export function validateMemoryEntry(entry: MemoryEntry): { ok: true } | { ok: false; error: string } {
  if (!isValidScope(entry.scope)) return { ok: false, error: `invalid scope: ${entry.scope}` };
  if (!entry.key || entry.key.length > 200) return { ok: false, error: "key required (<=200)" };
  if (typeof entry.value !== "object" || entry.value === null) {
    return { ok: false, error: "value must be a JSON object" };
  }
  if (entry.confidence != null && (entry.confidence < 0 || entry.confidence > 1)) {
    return { ok: false, error: "confidence must be in [0,1]" };
  }
  return { ok: true };
}
