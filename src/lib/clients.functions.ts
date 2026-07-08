import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Unified list: all client ad accounts across Meta + Google, grouped by parent (BM / MCC).
export type UnifiedAccount = {
  id: string;
  platform: "meta" | "google";
  external_id: string;
  name: string;
  parent_id: string | null;
  parent_label: string | null;
  is_manager: boolean;
  is_client_account: boolean;
  currency: string | null;
  status: string | null;
};

export type ManagerGroup = {
  key: string;                // parent_label or "__solo__"
  label: string;
  platform: "meta" | "google" | "mixed";
  accounts: UnifiedAccount[];
};

export const listAllAdAccounts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ groups: ManagerGroup[]; total: number }> => {
    const { supabase } = context;
    const [metaRes, googleRes] = await Promise.all([
      supabase
        .from("meta_ad_accounts")
        .select("id, name, ad_account_id, business_id, business_name, is_manager, is_client_account, parent_account_id, status")
        .order("business_name", { ascending: true, nullsFirst: false }),
      supabase
        .from("google_ad_accounts")
        .select("id, name, descriptive_name, customer_id, manager_customer_id, is_manager, parent_account_id, currency, status")
        .order("manager_customer_id", { ascending: true, nullsFirst: false }),
    ]);
    if (metaRes.error) throw new Error(metaRes.error.message);
    if (googleRes.error) throw new Error(googleRes.error.message);

    const meta = (metaRes.data ?? []) as Array<Record<string, unknown>>;
    const google = (googleRes.data ?? []) as Array<Record<string, unknown>>;

    const unified: UnifiedAccount[] = [];
    for (const m of meta) {
      unified.push({
        id: String(m.id),
        platform: "meta",
        external_id: String(m.ad_account_id),
        name: String(m.name || m.ad_account_id),
        parent_id: (m.parent_account_id as string | null) ?? (m.business_id as string | null) ?? null,
        parent_label: (m.business_name as string | null) ?? (m.business_id ? `BM ${m.business_id}` : null),
        is_manager: Boolean(m.is_manager),
        is_client_account: Boolean(m.is_client_account),
        currency: null,
        status: (m.status as string | null) ?? null,
      });
    }
    for (const g of google) {
      const parentCust = g.manager_customer_id as string | null;
      unified.push({
        id: String(g.id),
        platform: "google",
        external_id: String(g.customer_id),
        name: String(g.descriptive_name || g.name || g.customer_id),
        parent_id: (g.parent_account_id as string | null) ?? parentCust,
        parent_label: parentCust ? `MCC ${parentCust}` : null,
        is_manager: Boolean(g.is_manager),
        is_client_account: Boolean(parentCust),
        currency: (g.currency as string | null) ?? null,
        status: (g.status as string | null) ?? null,
      });
    }

    const map = new Map<string, ManagerGroup>();
    for (const a of unified) {
      const key = a.parent_label ?? (a.is_manager ? `${a.platform === "meta" ? "BM" : "MCC"} ${a.external_id}` : "__solo__");
      const label = key === "__solo__" ? "Contas sem gerenciadora" : key;
      const g = map.get(key);
      if (g) {
        g.accounts.push(a);
        if (g.platform !== a.platform) g.platform = "mixed";
      } else {
        map.set(key, { key, label, platform: a.platform, accounts: [a] });
      }
    }

    const groups = Array.from(map.values()).sort((x, y) => {
      if (x.key === "__solo__") return 1;
      if (y.key === "__solo__") return -1;
      return x.label.localeCompare(y.label);
    });

    return { groups, total: unified.length };
  });

export const getActiveClient = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data } = await supabase
      .from("active_client_selections")
      .select("platform, account_id, account_label, updated_at")
      .eq("user_id", userId)
      .maybeSingle();
    return { active: data ?? null };
  });

export const setActiveClient = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      platform: z.enum(["meta", "google"]),
      accountId: z.string().uuid(),
      label: z.string().max(200).optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: prof } = await supabase.from("profiles").select("organization_id").eq("id", userId).single();
    if (!prof?.organization_id) throw new Error("Organização não encontrada.");
    const { error } = await supabase.from("active_client_selections").upsert({
      user_id: userId,
      organization_id: prof.organization_id,
      platform: data.platform,
      account_id: data.accountId,
      account_label: data.label ?? null,
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const clearActiveClient = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { error } = await context.supabase
      .from("active_client_selections")
      .delete()
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
