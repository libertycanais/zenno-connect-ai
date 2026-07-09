// FEATURE P0.6 — Onda 4 · Prompt Versioning
// Immutable registry of system-prompt versions with SHA-256 fingerprint.
// Enables A/B rollout, audit ("what prompt produced this response?") and safe
// rollback. Additive to the existing prompt-builder — does NOT replace it.

export type PromptRecord = {
  key: string;                 // e.g. "system.free_chat"
  version: string;             // semver-like "1.0.0"
  content: string;
  fingerprint: string;         // sha-256 hex, first 16 chars
  createdAt: number;
  metadata?: Record<string, unknown>;
};

export type PromptRef = { key: string; version: string; fingerprint: string };

export async function fingerprintPrompt(content: string): Promise<string> {
  const enc = new TextEncoder().encode(content);
  const buf = await crypto.subtle.digest("SHA-256", enc);
  const hex = Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
  return hex.slice(0, 16);
}

export class PromptRegistry {
  private byKey = new Map<string, PromptRecord[]>();
  private activeVersion = new Map<string, string>();

  async register(key: string, version: string, content: string, metadata?: Record<string, unknown>): Promise<PromptRecord> {
    const list = this.byKey.get(key) ?? [];
    if (list.some((r) => r.version === version)) {
      throw new Error(`Prompt ${key}@${version} already registered (immutable)`);
    }
    const record: PromptRecord = {
      key,
      version,
      content,
      fingerprint: await fingerprintPrompt(content),
      createdAt: Date.now(),
      metadata,
    };
    list.push(record);
    this.byKey.set(key, list);
    if (!this.activeVersion.has(key)) this.activeVersion.set(key, version);
    return record;
  }

  activate(key: string, version: string): void {
    const list = this.byKey.get(key);
    if (!list?.some((r) => r.version === version)) {
      throw new Error(`Prompt ${key}@${version} not found`);
    }
    this.activeVersion.set(key, version);
  }

  get(key: string, version?: string): PromptRecord | undefined {
    const list = this.byKey.get(key);
    if (!list) return undefined;
    const target = version ?? this.activeVersion.get(key);
    return list.find((r) => r.version === target);
  }

  active(key: string): PromptRecord | undefined {
    const v = this.activeVersion.get(key);
    return v ? this.get(key, v) : undefined;
  }

  history(key: string): readonly PromptRecord[] {
    return this.byKey.get(key) ?? [];
  }

  ref(key: string, version?: string): PromptRef | undefined {
    const r = this.get(key, version);
    return r ? { key: r.key, version: r.version, fingerprint: r.fingerprint } : undefined;
  }
}

export const promptRegistry = new PromptRegistry();
