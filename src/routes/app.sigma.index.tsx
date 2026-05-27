import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { listIntegrations, createIntegration, updateIntegration, deleteIntegration } from "@/lib/sigma.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Server } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/sigma/")({
  component: SigmaIntegrationsPage,
});

function SigmaIntegrationsPage() {
  const qc = useQueryClient();
  const listFn = useServerFn(listIntegrations);
  const updateFn = useServerFn(updateIntegration);
  const deleteFn = useServerFn(deleteIntegration);
  const { data } = useQuery({ queryKey: ["sigma-integrations"], queryFn: () => listFn() });
  const integrations = data?.integrations ?? [];

  const updateMut = useMutation({
    mutationFn: (input: any) => updateFn({ data: input }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sigma-integrations"] });
      toast.success("Integração atualizada");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sigma-integrations"] });
      toast.success("Integração removida");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold">Integrações cadastradas</h2>
        <CreateDialog />
      </div>
      {integrations.length === 0 && (
        <Card className="p-10 text-center text-sm text-muted-foreground">
          <Server className="mx-auto mb-3 opacity-50" />
          Nenhuma integração ainda. Cadastre sua primeira API.
        </Card>
      )}
      <div className="grid gap-3">
        {integrations.map((i: any) => (
          <Card key={i.id} className="p-4 flex items-center gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-medium">{i.name}</span>
                <Badge variant="outline">{i.auth_type}</Badge>
                <Badge className={i.status === "active" ? "bg-green-500/15 text-green-500" : "bg-muted text-muted-foreground"}>
                  {i.status}
                </Badge>
              </div>
              <div className="text-xs text-muted-foreground truncate">{i.base_url}</div>
              {i.description && <div className="text-xs text-muted-foreground mt-1">{i.description}</div>}
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => updateMut.mutate({ id: i.id, status: i.status === "active" ? "paused" : "active" })}
            >
              {i.status === "active" ? "Pausar" : "Ativar"}
            </Button>
            <Button variant="ghost" size="icon" aria-label="Remover integração Sigma" onClick={() => { if (confirm("Remover?")) deleteMut.mutate(i.id); }}>
              <Trash2 size={14} className="text-destructive" />
            </Button>
          </Card>
        ))}
      </div>
    </div>
  );
}

function CreateDialog() {
  const qc = useQueryClient();
  const createFn = useServerFn(createIntegration);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", description: "", base_url: "", auth_type: "none", auth_token: "", headersText: "" });

  const mut = useMutation({
    mutationFn: (payload: any) => createFn({ data: payload }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sigma-integrations"] });
      toast.success("Integração criada");
      setOpen(false);
      setForm({ name: "", description: "", base_url: "", auth_type: "none", auth_token: "", headersText: "" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function submit() {
    let headers: Record<string, string> = {};
    if (form.headersText.trim()) {
      try { headers = JSON.parse(form.headersText); } catch { toast.error("Headers inválidos (use JSON)"); return; }
    }
    const payload: any = { name: form.name, base_url: form.base_url, auth_type: form.auth_type, headers };
    if (form.description) payload.description = form.description;
    if (form.auth_token) payload.auth_token = form.auth_token;
    mut.mutate(payload);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button><Plus size={14} className="mr-1" /> Nova Integração</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Nova Integração</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <Input placeholder="Nome *" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <Input placeholder="Descrição" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <Input placeholder="Base URL * (https://api.exemplo.com)" value={form.base_url} onChange={(e) => setForm({ ...form, base_url: e.target.value })} />
          <Select value={form.auth_type} onValueChange={(v) => setForm({ ...form, auth_type: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Sem autenticação</SelectItem>
              <SelectItem value="bearer">Bearer Token</SelectItem>
              <SelectItem value="api_key">API Key (X-API-Key)</SelectItem>
              <SelectItem value="basic">Basic Auth (base64)</SelectItem>
            </SelectContent>
          </Select>
          {form.auth_type !== "none" && (
            <Input placeholder="Token / Chave" value={form.auth_token} onChange={(e) => setForm({ ...form, auth_token: e.target.value })} />
          )}
          <Textarea placeholder='Headers extras em JSON (ex: {"X-Custom": "valor"})' value={form.headersText} onChange={(e) => setForm({ ...form, headersText: e.target.value })} rows={3} />
        </div>
        <DialogFooter>
          <Button disabled={!form.name || !form.base_url || mut.isPending} onClick={submit}>Criar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
