import { describe, it, expect } from "vitest";
import { ShareTokenSigner, ShareTokenRevocationStore } from "@/lib/workspace/share-tokens";

const SECRET = "a".repeat(48);

describe("Signed Share Tokens (HMAC + Replay)", () => {
  it("issues and verifies a valid token with all expected claims", () => {
    const s = new ShareTokenSigner(SECRET);
    const { token, payload } = s.issue({
      audience: "public_read", organizationId: "org_a", workspaceId: "ws_1", snapshotVersion: 3,
    });
    expect(payload.nonce.length).toBeGreaterThanOrEqual(16);
    expect(payload.expiresAt - payload.issuedAt).toBeGreaterThanOrEqual(7 * 24 * 3600);
    const v = s.verify(token, { audience: "public_read", organizationId: "org_a", workspaceId: "ws_1" });
    expect(v.ok).toBe(true);
  });

  it("rejects cross-audience / cross-org / cross-workspace replay", () => {
    const s = new ShareTokenSigner(SECRET);
    const { token } = s.issue({ audience: "public_read", organizationId: "org_a", workspaceId: "ws_1", snapshotVersion: 1 });
    expect(s.verify(token, { audience: "org_member" })).toEqual(expect.objectContaining({ ok: false, reason: "audience_mismatch" }));
    expect(s.verify(token, { organizationId: "org_b" })).toEqual(expect.objectContaining({ ok: false, reason: "org_mismatch" }));
    expect(s.verify(token, { workspaceId: "ws_2" })).toEqual(expect.objectContaining({ ok: false, reason: "workspace_mismatch" }));
  });

  it("rejects tampered signature", () => {
    const s = new ShareTokenSigner(SECRET);
    const { token } = s.issue({ audience: "public_read", organizationId: "o", workspaceId: "w", snapshotVersion: 1 });
    const [body] = token.split(".");
    const forged = `${body}.${"A".repeat(43)}`;
    expect(s.verify(forged).ok).toBe(false);
  });

  it("rejects stale snapshot version", () => {
    const s = new ShareTokenSigner(SECRET);
    const { token } = s.issue({ audience: "public_read", organizationId: "o", workspaceId: "w", snapshotVersion: 2 });
    const v = s.verify(token, { minSnapshotVersion: 5 });
    expect(v.ok).toBe(false);
  });

  it("rejects expired token", () => {
    const s = new ShareTokenSigner(SECRET);
    const { token } = s.issue({ audience: "public_read", organizationId: "o", workspaceId: "w", snapshotVersion: 1, ttlSeconds: -1 });
    expect(s.verify(token)).toEqual(expect.objectContaining({ ok: false, reason: "expired" }));
  });

  it("revocation store blocks replayed nonces", () => {
    const s = new ShareTokenSigner(SECRET);
    const store = new ShareTokenRevocationStore();
    const { payload } = s.issue({ audience: "public_read", organizationId: "o", workspaceId: "w", snapshotVersion: 1 });
    store.revoke(payload.nonce);
    expect(store.isRevoked(payload.nonce)).toBe(true);
  });

  it("rejects secrets shorter than 32 chars", () => {
    expect(() => new ShareTokenSigner("short")).toThrow(/share_token_secret_too_short/);
  });
});
