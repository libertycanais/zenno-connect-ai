// EPIC K — Signed Share Tokens (HMAC-SHA256, non-guessable, TTL 7d default)
import { createHmac, randomBytes, timingSafeEqual } from "crypto";
import type { ShareAudience, ShareTokenPayload, SignedShareToken } from "./types";

const DEFAULT_TTL_SECONDS = 7 * 24 * 3600;

export type ShareTokenIssueInput = {
  audience: ShareAudience;
  organizationId: string;
  workspaceId: string;
  snapshotVersion: number;
  ttlSeconds?: number;
};

export type ShareTokenVerifyExpectation = {
  audience?: ShareAudience;
  organizationId?: string;
  workspaceId?: string;
  minSnapshotVersion?: number;
};

export type ShareTokenVerifyResult =
  | { ok: true; payload: ShareTokenPayload }
  | { ok: false; reason: ShareTokenFailure };

export type ShareTokenFailure =
  | "malformed" | "malformed_payload" | "bad_signature" | "expired"
  | "audience_mismatch" | "org_mismatch" | "workspace_mismatch" | "snapshot_stale";

export class ShareTokenSigner {
  constructor(private readonly secret: string) {
    if (!secret || secret.length < 32) throw new Error("share_token_secret_too_short");
  }

  issue(input: ShareTokenIssueInput): SignedShareToken {
    const nowSec = Math.floor(Date.now() / 1000);
    const ttl = input.ttlSeconds ?? DEFAULT_TTL_SECONDS;
    const payload: ShareTokenPayload = {
      audience: input.audience,
      organizationId: input.organizationId,
      workspaceId: input.workspaceId,
      snapshotVersion: input.snapshotVersion,
      nonce: randomBytes(16).toString("hex"),
      issuedAt: nowSec,
      expiresAt: nowSec + ttl,
    };
    const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
    const sig = createHmac("sha256", this.secret).update(body).digest("base64url");
    return { token: `${body}.${sig}`, payload };
  }

  verify(token: string, expected: ShareTokenVerifyExpectation = {}): ShareTokenVerifyResult {
    if (typeof token !== "string" || !token.includes(".")) {
      return { ok: false, reason: "malformed" };
    }
    const [body, sig] = token.split(".");
    if (!body || !sig) return { ok: false, reason: "malformed" };

    const expectedSig = createHmac("sha256", this.secret).update(body).digest("base64url");
    const a = Buffer.from(sig); const b = Buffer.from(expectedSig);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return { ok: false, reason: "bad_signature" };

    let payload: ShareTokenPayload;
    try { payload = JSON.parse(Buffer.from(body, "base64url").toString()) as ShareTokenPayload; }
    catch { return { ok: false, reason: "malformed_payload" }; }

    const nowSec = Math.floor(Date.now() / 1000);
    if (payload.expiresAt <= nowSec) return { ok: false, reason: "expired" };
    if (expected.audience && payload.audience !== expected.audience) return { ok: false, reason: "audience_mismatch" };
    if (expected.organizationId && payload.organizationId !== expected.organizationId) return { ok: false, reason: "org_mismatch" };
    if (expected.workspaceId && payload.workspaceId !== expected.workspaceId) return { ok: false, reason: "workspace_mismatch" };
    if (expected.minSnapshotVersion !== undefined && payload.snapshotVersion < expected.minSnapshotVersion) {
      return { ok: false, reason: "snapshot_stale" };
    }
    return { ok: true, payload };
  }
}

/**
 * Revocation registry (nonce-scoped). In-memory por padrão; RC1.1 permite
 * plugar um checker persistente (Supabase workspace_share_tokens.revoked_at)
 * via `attachAsyncChecker`.
 */
export class ShareTokenRevocationStore {
  private revoked = new Set<string>();
  private asyncCheck?: (nonce: string) => Promise<boolean>;

  revoke(nonce: string): void { this.revoked.add(nonce); }
  isRevoked(nonce: string): boolean { return this.revoked.has(nonce); }
  clear(): void { this.revoked.clear(); this.asyncCheck = undefined; }

  /** RC1.1 — Wire a persistent revocation checker (returns true if revoked). */
  attachAsyncChecker(fn: (nonce: string) => Promise<boolean>): void {
    this.asyncCheck = fn;
  }

  async isRevokedAsync(nonce: string): Promise<boolean> {
    if (this.revoked.has(nonce)) return true;
    if (!this.asyncCheck) return false;
    try { return await this.asyncCheck(nonce); } catch { return false; }
  }
}

