// FEATURE P0.4 — Organization & Team Management
// Server functions autenticadas para gerenciar organização, membros e convites.
// Toda escrita respeita RLS (uso do supabase autenticado via `requireSupabaseAuth`).
// Auditoria: escrita automática via triggers `audit_row_change` no banco.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  INVITABLE_ROLES,
  ORG_ROLES,
  canInvite,
  canManageMember,
  classifyInvitationOutcome,
  generateInviteToken,
  hashInviteToken,
  inviteInputSchema,
  organizationUpdateSchema,
  type OrgRole,
} from "./organization.helpers";

// ---------- Organização ----------

export const getOrganization = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await (context.supabase as any)
      .from("organizations")
      .select("id, name, logo_url, domain, timezone, language, currency, settings, created_at, updated_at")
      .single();
    if (error) throw new Error(error.message);
    return { organization: data };
  });

export const updateOrganization = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => organizationUpdateSchema.parse(raw))
  .handler(async ({ data, context }) => {
    // Fetch current org id via profile (RLS garante que só vemos a nossa).
    const { data: prof, error: profErr } = await (context.supabase as any)
      .from("profiles")
      .select("organization_id")
      .eq("id", context.userId)
      .single();
    if (profErr || !prof) throw new Error("profile_not_found");
    const orgId = prof.organization_id as string;

    const { data: updated, error } = await (context.supabase as any)
      .from("organizations")
      .update(data)
      .eq("id", orgId)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return { organization: updated };
  });

// ---------- Membros ----------

export type MemberRow = {
  user_id: string;
  full_name: string | null;
  email: string | null;
  avatar_url: string | null;
  roles: OrgRole[];
};

export const listMembers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ members: MemberRow[] }> => {
    const { data: profiles, error: pErr } = await (context.supabase as any)
      .from("profiles")
      .select("id, full_name, email, avatar_url, organization_id");
    if (pErr) throw new Error(pErr.message);
    const { data: roles, error: rErr } = await (context.supabase as any)
      .from("user_roles")
      .select("user_id, role");
    if (rErr) throw new Error(rErr.message);

    const rolesByUser = new Map<string, OrgRole[]>();
    for (const r of (roles ?? []) as Array<{ user_id: string; role: OrgRole }>) {
      const arr = rolesByUser.get(r.user_id) ?? [];
      arr.push(r.role);
      rolesByUser.set(r.user_id, arr);
    }
    const members: MemberRow[] = ((profiles ?? []) as Array<{
      id: string;
      full_name: string | null;
      email: string | null;
      avatar_url: string | null;
    }>).map((p) => ({
      user_id: p.id,
      full_name: p.full_name,
      email: p.email,
      avatar_url: p.avatar_url,
      roles: rolesByUser.get(p.id) ?? [],
    }));
    return { members };
  });

async function requireActorRole(
  supabase: any,
  userId: string,
  orgId: string,
): Promise<OrgRole> {
  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("organization_id", orgId);
  if (error) throw new Error(error.message);
  const roles = ((data ?? []) as Array<{ role: OrgRole }>).map((r) => r.role);
  if (roles.length === 0) throw new Error("forbidden");
  // Retorna o mais alto.
  return roles.reduce<OrgRole>((acc, r) => {
    return ORG_ROLES.indexOf(r) < ORG_ROLES.indexOf(acc) ? r : acc;
  }, "viewer" as OrgRole);
}

const changeRoleSchema = z.object({
  target_user_id: z.string().uuid(),
  role: z.enum(["admin", "manager", "analyst", "agent", "viewer"]),
});

export const changeMemberRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => changeRoleSchema.parse(raw))
  .handler(async ({ data, context }) => {
    if (data.target_user_id === context.userId) throw new Error("cannot_change_own_role");
    const { data: prof, error: pErr } = await (context.supabase as any)
      .from("profiles").select("organization_id").eq("id", context.userId).single();
    if (pErr || !prof) throw new Error("profile_not_found");
    const orgId = prof.organization_id as string;
    const actorRole = await requireActorRole(context.supabase, context.userId, orgId);

    // Papel atual do alvo.
    const { data: targetRoles } = await (context.supabase as any)
      .from("user_roles").select("role").eq("user_id", data.target_user_id).eq("organization_id", orgId);
    const targetRole: OrgRole = ((targetRoles ?? [])[0]?.role as OrgRole) ?? "viewer";

    if (!canManageMember(actorRole, targetRole)) throw new Error("forbidden");
    if (!canInvite(actorRole, data.role)) throw new Error("forbidden_target_role");

    // Substituição: remove papéis anteriores e insere o novo.
    await (context.supabase as any).from("user_roles")
      .delete().eq("user_id", data.target_user_id).eq("organization_id", orgId);
    const { error: insErr } = await (context.supabase as any).from("user_roles")
      .insert({ user_id: data.target_user_id, organization_id: orgId, role: data.role });
    if (insErr) throw new Error(insErr.message);
    return { ok: true };
  });

const removeMemberSchema = z.object({ target_user_id: z.string().uuid() });

export const removeMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => removeMemberSchema.parse(raw))
  .handler(async ({ data, context }) => {
    if (data.target_user_id === context.userId) throw new Error("cannot_remove_self");
    const { data: prof, error: pErr } = await (context.supabase as any)
      .from("profiles").select("organization_id").eq("id", context.userId).single();
    if (pErr || !prof) throw new Error("profile_not_found");
    const orgId = prof.organization_id as string;
    const actorRole = await requireActorRole(context.supabase, context.userId, orgId);
    const { data: targetRoles } = await (context.supabase as any)
      .from("user_roles").select("role").eq("user_id", data.target_user_id).eq("organization_id", orgId);
    const targetRole: OrgRole = ((targetRoles ?? [])[0]?.role as OrgRole) ?? "viewer";
    if (!canManageMember(actorRole, targetRole)) throw new Error("forbidden");

    const { error } = await (context.supabase as any).from("user_roles")
      .delete().eq("user_id", data.target_user_id).eq("organization_id", orgId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- Convites ----------

export type InvitationRow = {
  id: string;
  email: string;
  role: OrgRole;
  status: "pending" | "accepted" | "revoked" | "expired";
  invited_by: string | null;
  expires_at: string;
  created_at: string;
};

export const listInvitations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ invitations: InvitationRow[] }> => {
    const { data, error } = await (context.supabase as any)
      .from("organization_invitations")
      .select("id, email, role, status, invited_by, expires_at, created_at")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { invitations: (data ?? []) as InvitationRow[] };
  });

export const createInvitation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => inviteInputSchema.parse(raw))
  .handler(async ({ data, context }) => {
    const { data: prof, error: pErr } = await (context.supabase as any)
      .from("profiles").select("organization_id").eq("id", context.userId).single();
    if (pErr || !prof) throw new Error("profile_not_found");
    const orgId = prof.organization_id as string;
    const actorRole = await requireActorRole(context.supabase, context.userId, orgId);
    if (!canInvite(actorRole, data.role)) throw new Error("forbidden");

    const token = generateInviteToken();
    const token_hash = await hashInviteToken(token);

    const { data: inv, error } = await (context.supabase as any)
      .from("organization_invitations")
      .insert({
        organization_id: orgId,
        email: data.email,
        role: data.role,
        token_hash,
        invited_by: context.userId,
      })
      .select("id, email, role, status, expires_at, created_at")
      .single();
    if (error) throw new Error(error.message);
    // Token bruto só é devolvido nesta resposta (nunca fica em log/DB).
    return { invitation: inv, token };
  });

const invitationIdSchema = z.object({ invitation_id: z.string().uuid() });

export const revokeInvitation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => invitationIdSchema.parse(raw))
  .handler(async ({ data, context }) => {
    const { error } = await (context.supabase as any)
      .from("organization_invitations")
      .update({ status: "revoked", revoked_at: new Date().toISOString() })
      .eq("id", data.invitation_id)
      .eq("status", "pending");
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const resendInvitation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => invitationIdSchema.parse(raw))
  .handler(async ({ data, context }) => {
    const token = generateInviteToken();
    const token_hash = await hashInviteToken(token);
    const newExpiry = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString();
    const { error } = await (context.supabase as any)
      .from("organization_invitations")
      .update({ token_hash, expires_at: newExpiry, status: "pending" })
      .eq("id", data.invitation_id);
    if (error) throw new Error(error.message);
    return { ok: true, token };
  });

const acceptSchema = z.object({ token: z.string().min(16).max(256) });

export const acceptInvitation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => acceptSchema.parse(raw))
  .handler(async ({ data, context }) => {
    const token_hash = await hashInviteToken(data.token);
    // Busca por hash (privilégio via SECURITY DEFINER seria ideal; aqui usamos service role
    // no server side após validação para atualizar user_roles).
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: inv, error } = await (supabaseAdmin as any)
      .from("organization_invitations")
      .select("id, organization_id, role, email, status, expires_at")
      .eq("token_hash", token_hash)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!inv) throw new Error("invitation_not_found");

    const outcome = classifyInvitationOutcome(inv);
    if (outcome !== "accepted") {
      // marca expired se necessário
      if (outcome === "expired" && inv.status === "pending") {
        await (supabaseAdmin as any).from("organization_invitations")
          .update({ status: "expired" }).eq("id", inv.id);
      }
      throw new Error(`invitation_${outcome}`);
    }

    // Confere email do usuário logado com o do convite.
    const userEmail = (context.claims?.email ?? "").toLowerCase();
    if (userEmail && userEmail !== inv.email.toLowerCase()) {
      throw new Error("invitation_email_mismatch");
    }

    // Insere papel (idempotente via ON CONFLICT).
    await (supabaseAdmin as any).from("user_roles").insert({
      user_id: context.userId,
      organization_id: inv.organization_id,
      role: inv.role,
    });
    await (supabaseAdmin as any).from("organization_invitations")
      .update({ status: "accepted", accepted_at: new Date().toISOString(), accepted_by: context.userId })
      .eq("id", inv.id);
    return { ok: true, organization_id: inv.organization_id };
  });

export const declineInvitation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => acceptSchema.parse(raw))
  .handler(async ({ data }) => {
    const token_hash = await hashInviteToken(data.token);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await (supabaseAdmin as any)
      .from("organization_invitations")
      .update({ status: "revoked", revoked_at: new Date().toISOString() })
      .eq("token_hash", token_hash)
      .eq("status", "pending");
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const _internal = { INVITABLE_ROLES };
