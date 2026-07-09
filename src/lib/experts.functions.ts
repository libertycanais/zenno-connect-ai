// EPIC D — Server functions exposing Expert output persistence to the app.
// Client-safe module: heavy server-only imports live INSIDE handlers to keep
// `src/lib/ai/persistence/experts.server.ts` out of the client bundle.

import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import type {
  PersistedRecommendation, PersistedPlaybook, PersistedEvidence,
  RecommendationStatus,
} from "./ai/contracts/expert-persistence";

const ListInput = z.object({
  status: z.enum(["open", "in_progress", "resolved", "dismissed", "archived"]).optional(),
  limit: z.number().int().min(1).max(200).optional(),
});

async function resolveOrgId(
  supabase: { from: (t: string) => { select: (c: string) => { eq: (col: string, v: string) => { maybeSingle: () => Promise<{ data: { organization_id: string } | null; error: unknown }> } } } },
  userId: string,
): Promise<string> {
  const { data, error } = await supabase.from("profiles").select("organization_id")
    .eq("id", userId).maybeSingle();
  if (error || !data?.organization_id) throw new Error("No organization for current user");
  return data.organization_id;
}

export const listRecommendations = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => ListInput.parse(data))
  .handler(async ({ data, context }): Promise<PersistedRecommendation[]> => {
    const orgId = await resolveOrgId(context.supabase, context.userId);
    const { createSupabaseExpertRepositories } = await import("./ai/persistence/experts.server");
    const repos = createSupabaseExpertRepositories();
    return repos.recommendations.listByOrganization(orgId, {
      status: data.status as RecommendationStatus | undefined,
      limit: data.limit,
    });
  });

export const listPlaybooks = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => ListInput.pick({ limit: true }).parse(data))
  .handler(async ({ data, context }): Promise<PersistedPlaybook[]> => {
    const orgId = await resolveOrgId(context.supabase, context.userId);
    const { createSupabaseExpertRepositories } = await import("./ai/persistence/experts.server");
    const repos = createSupabaseExpertRepositories();
    return repos.playbooks.listByOrganization(orgId, data.limit);
  });

export const listEvidence = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => ListInput.pick({ limit: true }).parse(data))
  .handler(async ({ data, context }): Promise<PersistedEvidence[]> => {
    const orgId = await resolveOrgId(context.supabase, context.userId);
    const { createSupabaseExpertRepositories } = await import("./ai/persistence/experts.server");
    const repos = createSupabaseExpertRepositories();
    return repos.evidence.listByOrganization(orgId, data.limit);
  });

const UpdateStatusInput = z.object({
  recommendationId: z.string().min(1),
  status: z.enum(["open", "in_progress", "resolved", "dismissed", "archived"]),
});

export const updateRecommendationStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => UpdateStatusInput.parse(data))
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const orgId = await resolveOrgId(context.supabase, context.userId);
    const { createSupabaseExpertRepositories } = await import("./ai/persistence/experts.server");
    const repos = createSupabaseExpertRepositories();
    await repos.recommendations.updateStatus(orgId, data.recommendationId, data.status);
    return { ok: true };
  });
