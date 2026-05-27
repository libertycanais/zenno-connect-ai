import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Play, Zap } from "lucide-react";
import {
  listAutomations, upsertAutomation, toggleAutomation,
  deleteAutomation, runAutomationManually, type AutomationAction,
} from "@/lib/automations.functions";

export const Route = createFileRoute("/app/automacoes/")({
  component: AutomationsList,
});

type TriggerType = "lead.created" | "lead.status_changed" | "finance.overdue" | "whatsapp.message_received" | "manual";

const TRIGGER_LABELS: Record<TriggerType, string> = {
  "lead.created": "Lead criado",
  "lead.status_changed": "Status do lead mudou",
  "finance.overdue": "Transação vencida",
  "whatsapp.message_received": "Mensagem WhatsApp recebida",
  "manual": "Disparo manual",
};

function AutomationsList() {
  const qc = useQueryClient();
  const list = useServerFn(listAutomations);
  const toggle = useServerFn(toggleAutomation);
  const del = useServerFn(deleteAutomation);
  const runFn = useServerFn(runAutomationManually);

  const { data, isLoading } = useQuery({ queryKey: ["automations"], queryFn: () => list() });
  const refresh = () => qc.invalidateQueries({ queryKey: ["automations"] });

  return (
    <div className="space-y-4 max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Regras de automação</h2>
          <p className="text-sm text-muted-foreground">Use variáveis como <code>{`{{lead.name}}`}</code>, <code>{`{{lead.phone}}`}</code> nos templates.</p>
        </div>
        <AutomationDialog onSaved={refresh} />
      </div>

      {isLoading ? <p className="text-sm text-muted-foreground">Carregando…</p>
        : !data?.automations.length ? (
          <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">
            Nenhuma automação. Clique em <strong>Nova automação</strong>.
          </CardContent></Card>
        ) : (
          <div className="grid gap-3">
            {data.automations.map((a) => (
              <Card key={a.id}>
                <CardContent className="pt-5 flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <Zap size={16} className="text-primary" />
                      <h3 className="font-semibold">{a.name}</h3>
                      <Badge variant="secondary">{TRIGGER_LABELS[a.trigger_type as TriggerType] ?? a.trigger_type}</Badge>
                      {!a.is_active && <Badge variant="outline">inativa</Badge>}
                    </div>
                    {a.description && <p className="text-sm text-muted-foreground mt-1">{a.description}</p>}
                    <p className="text-xs text-muted-foreground mt-1">
                      {(a.actions as AutomationAction[]).length} ação(ões)
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch checked={a.is_active} onCheckedChange={(v) =>
                      toggle({ data: { id: a.id, is_active: v } }).then(refresh).catch((e: Error) => toast.error(e.message))
                    } />
                    <Button size="icon" variant="ghost" title="Disparar agora"
                      onClick={() => runFn({ data: { id: a.id, payload: {} } })
                        .then((r) => toast.success(`Disparada (${r.results.filter((x) => x.ok).length}/${r.results.length} ok)`))
                        .catch((e: Error) => toast.error(e.message))}>
                      <Play size={14} />
                    </Button>
                    <Button size="icon" variant="ghost" title="Excluir"
                      onClick={() => del({ data: { id: a.id } }).then(() => { toast.success("Excluída"); refresh(); })
                        .catch((e: Error) => toast.error(e.message))}>
                      <Trash2 size={14} />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
    </div>
  );
}

// =========== Dialog ===========
function AutomationDialog({ onSaved }: { onSaved: () => void }) {
  const upsert = useServerFn(upsertAutomation);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [trigger, setTrigger] = useState<TriggerType>("lead.created");
  const [toStatus, setToStatus] = useState("");
  const [actions, setActions] = useState<AutomationAction[]>([]);

  function reset() {
    setName(""); setDescription(""); setTrigger("lead.created"); setToStatus(""); setActions([]);
  }

  function addAction(type: AutomationAction["type"]) {
    const base: Record<string, AutomationAction> = {
      send_whatsapp: { type: "send_whatsapp", instance_id: "", phone_template: "{{lead.phone}}", message_template: "Olá {{lead.name}}!" },
      create_activity: { type: "create_activity", activity_type: "note", content_template: "Lead {{lead.name}} criado" },
      create_transaction: { type: "create_transaction", kind: "income", description_template: "Cobrança {{lead.name}}", amount: 0, due_days: 7 },
      webhook: { type: "webhook", url: "https://" },
    };
    setActions((a) => [...a, base[type]]);
  }

  function updateAction(i: number, patch: Partial<AutomationAction>) {
    setActions((arr) => arr.map((a, idx) => idx === i ? ({ ...a, ...patch } as AutomationAction) : a));
  }

  async function save() {
    if (!name.trim()) { toast.error("Informe o nome"); return; }
    if (!actions.length) { toast.error("Adicione ao menos uma ação"); return; }
    try {
      await upsert({
        data: {
          data: {
            name, description: description || null, trigger_type: trigger,
            trigger_config: trigger === "lead.status_changed" ? { to_status: toStatus || undefined } : {},
            actions, is_active: true,
          },
        },
      });
      toast.success("Automação criada");
      setOpen(false); reset(); onSaved();
    } catch (e) { toast.error((e as Error).message); }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
      <DialogTrigger asChild><Button><Plus size={16} className="mr-2" /> Nova automação</Button></DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Nova automação</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div>
            <label className="text-xs text-muted-foreground">Nome</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Saudação inicial" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Descrição</label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Gatilho</label>
            <Select value={trigger} onValueChange={(v) => setTrigger(v as TriggerType)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.keys(TRIGGER_LABELS) as TriggerType[]).map((k) => (
                  <SelectItem key={k} value={k}>{TRIGGER_LABELS[k]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {trigger === "lead.status_changed" && (
            <div>
              <label className="text-xs text-muted-foreground">Disparar quando status mudar para</label>
              <Input value={toStatus} onChange={(e) => setToStatus(e.target.value)} placeholder="ex: qualificado" />
            </div>
          )}

          <div className="border-t border-border pt-3">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-semibold">Ações</h4>
              <div className="flex gap-1 flex-wrap">
                <Button size="sm" variant="outline" onClick={() => addAction("send_whatsapp")}>+ WhatsApp</Button>
                <Button size="sm" variant="outline" onClick={() => addAction("create_activity")}>+ Atividade</Button>
                <Button size="sm" variant="outline" onClick={() => addAction("create_transaction")}>+ Transação</Button>
                <Button size="sm" variant="outline" onClick={() => addAction("webhook")}>+ Webhook</Button>
              </div>
            </div>
            {actions.length === 0 && <p className="text-xs text-muted-foreground">Nenhuma ação ainda.</p>}
            <div className="space-y-3">
              {actions.map((a, i) => (
                <Card key={i}><CardContent className="pt-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <Badge>{a.type}</Badge>
                    <Button size="icon" variant="ghost" onClick={() => setActions((arr) => arr.filter((_, idx) => idx !== i))}>
                      <Trash2 size={14} />
                    </Button>
                  </div>
                  {a.type === "send_whatsapp" && (
                    <>
                      <Input value={a.instance_id} onChange={(e) => updateAction(i, { instance_id: e.target.value })} placeholder="ID da instância WhatsApp (UUID)" />
                      <Input value={a.phone_template} onChange={(e) => updateAction(i, { phone_template: e.target.value })} placeholder="Telefone (template)" />
                      <Textarea value={a.message_template} onChange={(e) => updateAction(i, { message_template: e.target.value })} rows={3} placeholder="Mensagem" />
                    </>
                  )}
                  {a.type === "create_activity" && (
                    <>
                      <Input value={a.activity_type} onChange={(e) => updateAction(i, { activity_type: e.target.value })} placeholder="tipo (ex: note, call)" />
                      <Textarea value={a.content_template} onChange={(e) => updateAction(i, { content_template: e.target.value })} rows={2} placeholder="Conteúdo (template)" />
                    </>
                  )}
                  {a.type === "create_transaction" && (
                    <div className="grid grid-cols-3 gap-2">
                      <Select value={a.kind} onValueChange={(v) => updateAction(i, { kind: v as "income" | "expense" })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="income">Receita</SelectItem>
                          <SelectItem value="expense">Despesa</SelectItem>
                        </SelectContent>
                      </Select>
                      <Input type="number" step="0.01" value={a.amount} onChange={(e) => updateAction(i, { amount: Number(e.target.value) })} placeholder="Valor" />
                      <Input type="number" value={a.due_days} onChange={(e) => updateAction(i, { due_days: Number(e.target.value) })} placeholder="Dias p/ vencer" />
                      <Textarea className="col-span-3" value={a.description_template} onChange={(e) => updateAction(i, { description_template: e.target.value })} rows={2} placeholder="Descrição (template)" />
                    </div>
                  )}
                  {a.type === "webhook" && (
                    <Input value={a.url} onChange={(e) => updateAction(i, { url: e.target.value })} placeholder="https://..." />
                  )}
                </CardContent></Card>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter><Button onClick={save}>Salvar</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
