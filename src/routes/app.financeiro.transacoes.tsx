import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Trash2, Check, RotateCcw } from "lucide-react";
import {
  listTransactions, createTransaction, updateTransactionStatus,
  deleteTransaction, listCategories,
} from "@/lib/finance.functions";

export const Route = createFileRoute("/app/financeiro/transacoes")({
  component: TransactionsPage,
});

function fmt(n: number) {
  return Number(n).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function TransactionsPage() {
  const qc = useQueryClient();
  const listFn = useServerFn(listTransactions);
  const catsFn = useServerFn(listCategories);
  const createFn = useServerFn(createTransaction);
  const statusFn = useServerFn(updateTransactionStatus);
  const delFn = useServerFn(deleteTransaction);

  const { data, isLoading } = useQuery({ queryKey: ["fin-tx"], queryFn: () => listFn({ data: {} }) });
  const { data: cats } = useQuery({ queryKey: ["fin-cats"], queryFn: () => catsFn() });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["fin-tx"] });
    qc.invalidateQueries({ queryKey: ["finance-summary"] });
  };

  const mutCreate = useMutation({
    mutationFn: (input: NewTxInput) => createFn({ data: input }),
    onSuccess: () => { toast.success("Transação criada."); refresh(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const mutStatus = useMutation({
    mutationFn: (v: { id: string; status: "paid" | "pending" }) => statusFn({ data: v }),
    onSuccess: refresh,
    onError: (e: Error) => toast.error(e.message),
  });

  const mutDel = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: () => { toast.success("Excluída."); refresh(); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-4 max-w-6xl">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Transações</h2>
          <p className="text-sm text-muted-foreground">Lançamentos de receitas e despesas.</p>
        </div>
        <NewTxDialog categories={cats?.categories ?? []} onSubmit={(v) => mutCreate.mutate(v)} pending={mutCreate.isPending} />
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando…</p>
      ) : !data?.transactions.length ? (
        <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">
          Nenhuma transação. Clique em <strong>Nova transação</strong>.
        </CardContent></Card>
      ) : (
        <div className="rounded-md border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="text-left px-3 py-2">Vencimento</th>
                <th className="text-left px-3 py-2">Descrição</th>
                <th className="text-left px-3 py-2">Categoria</th>
                <th className="text-right px-3 py-2">Valor</th>
                <th className="text-center px-3 py-2">Status</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {data.transactions.map((t) => {
                const cat = (t as { finance_categories?: { name: string; color: string } | null }).finance_categories;
                return (
                  <tr key={t.id} className="border-t border-border">
                    <td className="px-3 py-2">{new Date(t.due_date).toLocaleDateString("pt-BR")}</td>
                    <td className="px-3 py-2">{t.description}</td>
                    <td className="px-3 py-2">
                      {cat ? <span className="inline-flex items-center gap-1.5"><span className="w-2 h-2 rounded-full" style={{ background: cat.color }} />{cat.name}</span> : "—"}
                    </td>
                    <td className={`px-3 py-2 text-right font-medium ${t.kind === "income" ? "text-emerald-500" : "text-destructive"}`}>
                      {t.kind === "income" ? "+" : "−"} {fmt(Number(t.amount))}
                    </td>
                    <td className="px-3 py-2 text-center">
                      <Badge variant={t.status === "paid" ? "default" : t.status === "overdue" ? "destructive" : "secondary"}>
                        {t.status}
                      </Badge>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <div className="flex gap-1 justify-end">
                        {t.status !== "paid" ? (
                          <Button size="icon" variant="ghost" title="Marcar pago" onClick={() => mutStatus.mutate({ id: t.id, status: "paid" })}><Check size={14} /></Button>
                        ) : (
                          <Button size="icon" variant="ghost" title="Reabrir" onClick={() => mutStatus.mutate({ id: t.id, status: "pending" })}><RotateCcw size={14} /></Button>
                        )}
                        <Button size="icon" variant="ghost" title="Excluir" onClick={() => mutDel.mutate(t.id)}><Trash2 size={14} /></Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

type NewTxInput = {
  kind: "income" | "expense";
  description: string;
  amount: number;
  currency: string;
  due_date: string;
  status: "pending" | "paid";
  category_id: string | null;
  notes: string | null;
};

function NewTxDialog({
  categories, onSubmit, pending,
}: { categories: { id: string; name: string; kind: string; color: string }[]; onSubmit: (v: NewTxInput) => void; pending: boolean }) {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<"income" | "expense">("expense");
  const [desc, setDesc] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [catId, setCatId] = useState<string>("none");
  const [notes, setNotes] = useState("");

  function submit() {
    const a = Number(amount.replace(",", "."));
    if (!desc || !a || a <= 0) { toast.error("Preencha descrição e valor."); return; }
    onSubmit({
      kind, description: desc, amount: a, currency: "BRL", due_date: date, status: "pending",
      category_id: catId === "none" ? null : catId, notes: notes || null,
    });
    setOpen(false);
    setDesc(""); setAmount(""); setNotes(""); setCatId("none");
  }

  const filteredCats = categories.filter((c) => c.kind === kind);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button><Plus size={16} className="mr-2" /> Nova transação</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Nova transação</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <Button type="button" variant={kind === "expense" ? "default" : "outline"} onClick={() => setKind("expense")}>Despesa</Button>
            <Button type="button" variant={kind === "income" ? "default" : "outline"} onClick={() => setKind("income")}>Receita</Button>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Descrição</label>
            <Input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Ex: Pagamento fornecedor" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-muted-foreground">Valor (R$)</label>
              <Input value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0,00" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Vencimento</label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Categoria</label>
            <Select value={catId} onValueChange={setCatId}>
              <SelectTrigger><SelectValue placeholder="Selecione…" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— Sem categoria —</SelectItem>
                {filteredCats.map((c) => (<SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Notas</label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={submit} disabled={pending}>Criar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
