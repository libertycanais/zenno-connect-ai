import { describe, expect, it } from "vitest";
import {
  canInvite,
  canManageMember,
  classifyInvitationOutcome,
  generateInviteToken,
  hashInviteToken,
  inviteInputSchema,
  isInvitationUsable,
  organizationUpdateSchema,
  roleDominates,
  roleRank,
} from "@/lib/organization.helpers";

describe("organization.helpers — RBAC", () => {
  it("roleRank respects hierarchy", () => {
    expect(roleRank("owner")).toBeGreaterThan(roleRank("admin"));
    expect(roleRank("admin")).toBeGreaterThan(roleRank("manager"));
    expect(roleRank("manager")).toBeGreaterThan(roleRank("analyst"));
    expect(roleRank("analyst")).toBeGreaterThan(roleRank("viewer"));
  });

  it("roleDominates works both directions", () => {
    expect(roleDominates("owner", "viewer")).toBe(true);
    expect(roleDominates("viewer", "owner")).toBe(false);
    expect(roleDominates("admin", "admin")).toBe(true);
  });

  it("canManageMember: owner can manage everyone except other owners", () => {
    expect(canManageMember("owner", "admin")).toBe(true);
    expect(canManageMember("owner", "viewer")).toBe(true);
    expect(canManageMember("owner", "owner")).toBe(false);
  });

  it("canManageMember: admin cannot touch owner or other admin", () => {
    expect(canManageMember("admin", "owner")).toBe(false);
    expect(canManageMember("admin", "admin")).toBe(false);
    expect(canManageMember("admin", "manager")).toBe(true);
  });

  it("canManageMember: non-privileged roles cannot manage", () => {
    for (const r of ["manager", "analyst", "agent", "viewer"] as const) {
      expect(canManageMember(r, "viewer")).toBe(false);
    }
  });

  it("canInvite: blocks owner invites and admin→admin escalation", () => {
    expect(canInvite("owner", "admin")).toBe(true);
    expect(canInvite("owner", "owner")).toBe(false);
    expect(canInvite("admin", "admin")).toBe(false);
    expect(canInvite("admin", "manager")).toBe(true);
    expect(canInvite("manager", "viewer")).toBe(false);
  });
});

describe("organization.helpers — validators", () => {
  it("inviteInputSchema normalizes email to lowercase", () => {
    const out = inviteInputSchema.parse({ email: "  Foo@Bar.COM ", role: "viewer" });
    expect(out.email).toBe("foo@bar.com");
  });

  it("inviteInputSchema rejects owner role", () => {
    expect(() => inviteInputSchema.parse({ email: "a@b.co", role: "owner" })).toThrow();
  });

  it("organizationUpdateSchema validates domain format", () => {
    expect(() =>
      organizationUpdateSchema.parse({ domain: "not a domain" }),
    ).toThrow();
    expect(organizationUpdateSchema.parse({ domain: "acme.com" }).domain).toBe("acme.com");
  });

  it("organizationUpdateSchema normalizes currency", () => {
    expect(organizationUpdateSchema.parse({ currency: "brl" }).currency).toBe("BRL");
  });

  it("organizationUpdateSchema rejects invalid language tags", () => {
    expect(() => organizationUpdateSchema.parse({ language: "portuguese" })).toThrow();
    expect(organizationUpdateSchema.parse({ language: "pt-BR" }).language).toBe("pt-BR");
  });
});

describe("organization.helpers — invitations", () => {
  it("generateInviteToken produces distinct base64url strings", () => {
    const a = generateInviteToken();
    const b = generateInviteToken();
    expect(a).not.toBe(b);
    expect(a).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(a.length).toBeGreaterThanOrEqual(32);
  });

  it("hashInviteToken is deterministic and 64 hex chars", async () => {
    const t = "test-token-value";
    const h1 = await hashInviteToken(t);
    const h2 = await hashInviteToken(t);
    expect(h1).toBe(h2);
    expect(h1).toMatch(/^[0-9a-f]{64}$/);
    const other = await hashInviteToken(t + "x");
    expect(other).not.toBe(h1);
  });

  it("isInvitationUsable: pending + future = true", () => {
    const future = new Date(Date.now() + 3600_000).toISOString();
    expect(isInvitationUsable({ status: "pending", expires_at: future })).toBe(true);
  });

  it("isInvitationUsable: expired or non-pending = false", () => {
    const past = new Date(Date.now() - 3600_000).toISOString();
    const future = new Date(Date.now() + 3600_000).toISOString();
    expect(isInvitationUsable({ status: "pending", expires_at: past })).toBe(false);
    expect(isInvitationUsable({ status: "accepted", expires_at: future })).toBe(false);
    expect(isInvitationUsable({ status: "revoked", expires_at: future })).toBe(false);
  });

  it("classifyInvitationOutcome returns proper labels", () => {
    const future = new Date(Date.now() + 3600_000).toISOString();
    const past = new Date(Date.now() - 3600_000).toISOString();
    expect(classifyInvitationOutcome({ status: "pending", expires_at: future })).toBe("accepted");
    expect(classifyInvitationOutcome({ status: "pending", expires_at: past })).toBe("expired");
    expect(classifyInvitationOutcome({ status: "accepted", expires_at: future })).toBe("already_used");
    expect(classifyInvitationOutcome({ status: "revoked", expires_at: future })).toBe("revoked");
  });
});
