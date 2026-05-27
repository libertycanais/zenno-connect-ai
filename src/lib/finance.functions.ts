import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const TxKind = z.enum(["income", "expense"]);
const TxStatus = z.enum(["pending", "paid", "overdue", "cancelled"]);

// ============ Categorias ============
export const listCategories = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("finance_categories")
      .select("*")
      .order("name");
    if (error) throw new Error(error.message);
    return { categories: data ?? [] };
  });

export const createCategory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ name: z.string().min(1).max(80), kind: TxKind, color: z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#6366f1") }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: prof } = await supabase.from("profiles").select("organization_id").eq("id", context.userId).single();
    if (!prof) throw new Error("Perfil não encontrado");
    const { data: row, error } = await supabase
      .from("finance_categories")
      .insert({ name: data.name, kind: data.kind, color: data.color, organization_id: prof.organization_id })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return { category: row };
  });

export const deleteCategory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("finance_categories").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ============ Transações ============
const txInput = z.object({
  kind: TxKind,
  description: z.string().min(1).max(255),
  amount: z.number().positive(),
  currency: z.string().min(3).max(3).default("BRL"),
  due_date: z.string(),
  status: TxStatus.default("pending"),
  category_id: z.string().uuid().nullable().optional(),
  lead_id: z.string().uuid().nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
});

export const listTransactions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      status: TxStatus.optional(),
      kind: TxKind.optional(),
      from: z.string().optional(),
      to: z.string().optional(),
    }).parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    let q = context.supabase
      .from("finance_transactions")
      .select("*")
      .order("due_date", { ascending: false })
      .limit(500);
    if (data.status) q = q.eq("status", data.status);
    if (data.kind) q = q.eq("kind", data.kind);
    if (data.from) q = q.gte("due_date", data.from);
    if (data.to) q = q.lte("due_date", data.to);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return { transactions: rows ?? [] };
  });

export const createTransaction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => txInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: prof } = await supabase.from("profiles").select("organization_id").eq("id", userId).single();
    if (!prof) throw new Error("Perfil não encontrado");
    const { data: row, error } = await supabase
      .from("finance_transactions")
      .insert({ ...data, organization_id: prof.organization_id, created_by: userId })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return { transaction: row };
  });

export const updateTransactionStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid(), status: TxStatus }).parse(d))
  .handler(async ({ data, context }) => {
    const patch: { status: typeof data.status; paid_at: string | null } = {
      status: data.status,
      paid_at: data.status === "paid" ? new Date().toISOString() : null,
    };
    const { error } = await context.supabase.from("finance_transactions").update(patch).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteTransaction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("finance_transactions").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ============ Dashboard ============
export const getFinanceSummary = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const today = new Date();
    const first = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10);
    const last = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().slice(0, 10);
    const { data: rows, error } = await context.supabase
      .from("finance_transactions")
      .select("kind,status,amount,due_date")
      .gte("due_date", first)
      .lte("due_date", last);
    if (error) throw new Error(error.message);
    const r = rows ?? [];
    const sum = (pred: (x: typeof r[number]) => boolean) =>
      r.filter(pred).reduce((acc, x) => acc + Number(x.amount), 0);
    return {
      month: { start: first, end: last },
      income_paid: sum((x) => x.kind === "income" && x.status === "paid"),
      income_pending: sum((x) => x.kind === "income" && x.status === "pending"),
      expense_paid: sum((x) => x.kind === "expense" && x.status === "paid"),
      expense_pending: sum((x) => x.kind === "expense" && x.status === "pending"),
      count: r.length,
    };
  });
