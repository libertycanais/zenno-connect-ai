import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Trash2, Plus } from "lucide-react";
import { listCategories, createCategory, deleteCategory } from "@/lib/finance.functions";

export const Route = createFileRoute("/app/financeiro/categorias")({
  component: CategoriesPage,
});

function CategoriesPage() {
  const qc = useQueryClient();
  const listFn = useServerFn(listCategories);
  const addFn = useServerFn(createCategory);
  const delFn = useServerFn(deleteCategory);

  const { data, isLoading } = useQuery({ queryKey: ["fin-cats"], queryFn: () => listFn() });
  const [name, setName] = useState("");
  const [kind, setKind] = useState<"income" | "expense">("expense");
  const [color, setColor] = useState("#6366f1");

  const add = useMutation({
    mutationFn: () => addFn({ data: { name, kind, color } }),
    onSuccess: () => { toast.success("Categoria criada."); setName(""); qc.invalidateQueries({ queryKey: ["fin-cats"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: () => { toast.success("Excluída."); qc.invalidateQueries({ queryKey: ["fin-cats"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const groups = {
    income: data?.categories.filter((c) => c.kind === "income") ?? [],
    expense: data?.categories.filter((c) => c.kind === "expense") ?? [],
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <Card>
        <CardContent className="pt-6 flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[200px]">
            <label className="text-xs text-muted-foreground">Nome</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Marketing" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground block">Tipo</label>
            <div className="flex gap-1">
              <Button type="button" size="sm" variant={kind === "expense" ? "default" : "outline"} onClick={() => setKind("expense")}>Despesa</Button>
              <Button type="button" size="sm" variant={kind === "income" ? "default" : "outline"} onClick={() => setKind("income")}>Receita</Button>
            </div>
          </div>
          <div>
            <label className="text-xs text-muted-foreground block">Cor</label>
            <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-9 w-12 rounded border border-border bg-transparent" />
          </div>
          <Button onClick={() => add.mutate()} disabled={!name || add.isPending}><Plus size={16} className="mr-1" /> Adicionar</Button>
        </CardContent>
      </Card>

      {isLoading ? <p className="text-sm text-muted-foreground">Carregando…</p> : (
        <div className="grid gap-6 md:grid-cols-2">
          {(["expense", "income"] as const).map((k) => (
            <div key={k}>
              <h3 className="text-sm font-semibold mb-2">{k === "expense" ? "Despesas" : "Receitas"}</h3>
              {groups[k].length === 0 ? <p className="text-xs text-muted-foreground">Nenhuma.</p> : (
                <ul className="space-y-1">
                  {groups[k].map((c) => (
                    <li key={c.id} className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm">
                      <span className="inline-flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full" style={{ background: c.color }} />{c.name}
                      </span>
                      <Button size="icon" variant="ghost" aria-label="Excluir categoria" onClick={() => del.mutate(c.id)}><Trash2 size={14} /></Button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
