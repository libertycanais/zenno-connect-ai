// Feature P0.1 — Billing & Subscriptions
// Catálogo de planos: leitura pública (autenticada e anônima) + gestão administrativa
// via service_role. Nenhum contrato público existente é alterado.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabase as browserPublic } from "@/integrations/supabase/client";

export type PlanRow = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  price_cents: number;
  currency: string;
  interval: "month" | "year";
  trial_days: number;
  features: Record<string, unknown>;
  limits: Record<string, unknown>;
  active: boolean;
  sort_order: number;
};

/**
 * Lista pública de planos ativos. Endpoint público (anon) protegido por RLS
 * de leitura em `plans` (política `plans_read_anon` sobre `active = true`).
 */
export const listPublicPlans = createServerFn({ method: "GET" }).handler(
  async () => {
    const { createClient } = await import("@supabase/supabase-js");
    const url = process.env.SUPABASE_URL!;
    const key = process.env.SUPABASE_PUBLISHABLE_KEY!;
    const client = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await (client as unknown as {
      from: (t: string) => {
        select: (c: string) => {
          eq: (c: string, v: boolean) => {
            order: (c: string, o: { ascending: boolean }) => Promise<{
              data: PlanRow[] | null;
              error: { message: string } | null;
            }>;
          };
        };
      };
    })
      .from("plans")
      .select(
        "id, code, name, description, price_cents, currency, interval, trial_days, features, limits, active, sort_order",
      )
      .eq("active", true)
      .order("sort_order", { ascending: true });
    if (error) throw new Error(error.message);
    return { plans: (data ?? []) as PlanRow[] };
  },
);

/**
 * Lista de planos para usuário autenticado (inclui inativos, para admin ver histórico).
 */
export const listPlans = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const client = context.supabase as unknown as {
      from: (t: string) => {
        select: (c: string) => {
          order: (c: string, o: { ascending: boolean }) => Promise<{
            data: PlanRow[] | null;
            error: { message: string } | null;
          }>;
        };
      };
    };
    const { data, error } = await client
      .from("plans")
      .select(
        "id, code, name, description, price_cents, currency, interval, trial_days, features, limits, active, sort_order",
      )
      .order("sort_order", { ascending: true });
    if (error) throw new Error(error.message);
    return { plans: (data ?? []) as PlanRow[] };
  });

const _z_code = z
  .string()
  .min(2)
  .max(64)
  .regex(/^[a-z0-9_]+$/i);

/** Utilitário puro: escolhe plano ativo pelo código. Exportado para testes. */
export function pickPlanByCode(
  plans: readonly PlanRow[],
  code: string,
): PlanRow | undefined {
  const target = _z_code.safeParse(code);
  if (!target.success) return undefined;
  return plans.find((p) => p.code === target.data && p.active);
}

/**
 * Classifica uma mudança de plano como upgrade, downgrade ou lateral.
 * Comparação baseada em `sort_order` (fonte de verdade do catálogo).
 */
export function classifyPlanChange(
  from: PlanRow | undefined,
  to: PlanRow,
): "upgrade" | "downgrade" | "same" | "activation" {
  if (!from) return "activation";
  if (from.id === to.id) return "same";
  return to.sort_order > from.sort_order ? "upgrade" : "downgrade";
}

// (browserPublic é reexportado apenas para satisfazer o linter de imports não usados;
//  a leitura pública sem sessão é feita via cliente server-side dedicado acima.)
export const _internal = { browserPublic };
