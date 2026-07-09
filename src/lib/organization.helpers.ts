// FEATURE P0.4 — Organization & Team Management
// Helpers puros e reutilizáveis (RBAC, convites, validações).
// Nenhum acesso a Supabase/Provider — apenas lógica isolada e testável.

import { z } from "zod";

/** Papéis suportados pelo módulo RBAC. Precisa refletir o enum `app_role` no banco. */
export const ORG_ROLES = [
  "owner",
  "admin",
  "manager",
  "analyst",
  "agent",
  "viewer",
] as const;
export type OrgRole = (typeof ORG_ROLES)[number];

/** Hierarquia numérica (maior = mais poder). Usada para comparação de papéis. */
const ROLE_RANK: Record<OrgRole, number> = {
  owner: 100,
  admin: 80,
  manager: 60,
  analyst: 40,
  agent: 30,
  viewer: 20,
};

export function roleRank(role: OrgRole): number {
  return ROLE_RANK[role] ?? 0;
}

/** Um papel `a` domina `b` se rank(a) >= rank(b). */
export function roleDominates(a: OrgRole, b: OrgRole): boolean {
  return roleRank(a) >= roleRank(b);
}

/** Regras de quem pode alterar o papel de outro membro. */
export function canManageMember(
  actor: OrgRole,
  target: OrgRole,
): boolean {
  // Só owner/admin gerenciam membros; nunca pode gerenciar quem tem rank >= o seu.
  if (actor !== "owner" && actor !== "admin") return false;
  return roleRank(actor) > roleRank(target);
}

/** Regras de quem pode convidar em qual nível. */
export function canInvite(actor: OrgRole, targetRole: OrgRole): boolean {
  if (actor !== "owner" && actor !== "admin") return false;
  // Ninguém convida owner via fluxo de convite (transferência é operação separada).
  if (targetRole === "owner") return false;
  // Admin não pode convidar outro admin (privilege escalation guard).
  if (actor === "admin" && targetRole === "admin") return false;
  return true;
}

/** Papéis atribuíveis por convite (excluindo owner). */
export const INVITABLE_ROLES: readonly OrgRole[] = [
  "admin",
  "manager",
  "analyst",
  "agent",
  "viewer",
] as const;

// ---------- Validação de payloads ----------

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email()
  .max(254);

export const inviteRoleSchema = z.enum([
  "admin",
  "manager",
  "analyst",
  "agent",
  "viewer",
]);

export const inviteInputSchema = z.object({
  email: emailSchema,
  role: inviteRoleSchema,
});

export type InviteInput = z.infer<typeof inviteInputSchema>;

export const organizationUpdateSchema = z.object({
  name: z.string().trim().min(2).max(200).optional(),
  logo_url: z
    .string()
    .trim()
    .max(2048)
    .url()
    .optional()
    .or(z.literal("").transform(() => undefined)),
  domain: z
    .string()
    .trim()
    .toLowerCase()
    .max(253)
    .regex(/^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$/)
    .optional()
    .or(z.literal("").transform(() => undefined)),
  timezone: z.string().trim().min(1).max(64).optional(),
  language: z
    .string()
    .trim()
    .regex(/^[a-z]{2}(-[A-Z]{2})?$/)
    .optional(),
  currency: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{3}$/)
    .optional(),
});
export type OrganizationUpdate = z.infer<typeof organizationUpdateSchema>;

// ---------- Convite: token / expiração ----------

/** Gera token opaco base64url (256 bits) usando WebCrypto (isomórfico). */
export function generateInviteToken(bytes = 32): string {
  const buf = new Uint8Array(bytes);
  crypto.getRandomValues(buf);
  let bin = "";
  for (const b of buf) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

/** SHA-256 → hex do token, para armazenamento (nunca guardar o token bruto). */
export async function hashInviteToken(token: string): Promise<string> {
  const data = new TextEncoder().encode(token);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export type InvitationStatus = "pending" | "accepted" | "revoked" | "expired";

export function isInvitationUsable(inv: {
  status: InvitationStatus;
  expires_at: string | Date;
}, now: Date = new Date()): boolean {
  if (inv.status !== "pending") return false;
  const exp = inv.expires_at instanceof Date ? inv.expires_at : new Date(inv.expires_at);
  return exp.getTime() > now.getTime();
}

/** Deriva o próximo status após tentativa de aceite. */
export function classifyInvitationOutcome(inv: {
  status: InvitationStatus;
  expires_at: string | Date;
}, now: Date = new Date()): "accepted" | "expired" | "already_used" | "revoked" {
  if (inv.status === "accepted") return "already_used";
  if (inv.status === "revoked") return "revoked";
  const exp = inv.expires_at instanceof Date ? inv.expires_at : new Date(inv.expires_at);
  if (exp.getTime() <= now.getTime()) return "expired";
  return "accepted";
}
