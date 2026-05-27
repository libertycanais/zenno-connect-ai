import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { listTickets, createTicket, updateTicket, deleteTicket, addTicketMessage, getTicket, getTicketStats } from "@/lib/tickets.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, MessageCircle } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/tickets/")({
  component: TicketsPage,
});

const STATUS_COLORS: Record<string, string> = {
  open: "bg-blue-500/15 text-blue-500",
  pending: "bg-yellow-500/15 text-yellow-500",
  resolved: "bg-green-500/15 text-green-500",
  closed: "bg-muted text-muted-foreground",
};
const PRIORITY_COLORS: Record<string, string> = {
  low: "bg-muted text-muted-foreground",
  normal: "bg-blue-500/15 text-blue-500",
  high: "bg-orange-500/15 text-orange-500",
  urgent: "bg-red-500/15 text-red-500",
};

function TicketsPage() {
  const qc = useQueryClient();
  const listFn = useServerFn(listTickets);
  const statsFn = useServerFn(getTicketStats);
  const updateFn = useServerFn(updateTicket);
  const deleteFn = useServerFn(deleteTicket);

  const { data: ticketsData } = useQuery({ queryKey: ["tickets"], queryFn: () => listFn() });
  const { data: stats } = useQuery({ queryKey: ["tickets-stats"], queryFn: () => statsFn() });
  const tickets = ticketsData?.tickets ?? [];

  const [selectedId, setSelectedId] = useState<string | null>(null);

  const updateMut = useMutation({
    mutationFn: (input: any) => updateFn({ data: input }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tickets"] });
      qc.invalidateQueries({ queryKey: ["tickets-stats"] });
      if (selectedId) qc.invalidateQueries({ queryKey: ["ticket", selectedId] });
      toast.success("Ticket atualizado");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tickets"] });
      qc.invalidateQueries({ queryKey: ["tickets-stats"] });
      setSelectedId(null);
      toast.success("Ticket removido");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <StatCard label="Total" value={stats?.total ?? 0} />
        <StatCard label="Abertos" value={stats?.open ?? 0} accent="text-blue-500" />
        <StatCard label="Pendentes" value={stats?.pending ?? 0} accent="text-yellow-500" />
        <StatCard label="Resolvidos" value={stats?.resolved ?? 0} accent="text-green-500" />
        <StatCard label="Urgentes" value={stats?.urgent ?? 0} accent="text-red-500" />
      </div>

      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold">Chamados</h2>
        <CreateTicketDialog />
      </div>

      <Card className="divide-y divide-border">
        {tickets.length === 0 && (
          <div className="p-10 text-center text-muted-foreground text-sm">Nenhum ticket ainda. Crie o primeiro.</div>
        )}
        {tickets.map((t: any) => (
          <div key={t.id} className="p-4 flex items-center gap-4 hover:bg-muted/30 transition-colors">
            <div className="flex-1 min-w-0">
              <div className="font-medium truncate">{t.subject}</div>
              <div className="text-xs text-muted-foreground truncate">
                {t.requester_name || "Sem solicitante"} · {new Date(t.created_at).toLocaleString("pt-BR")}
              </div>
            </div>
            <Badge className={PRIORITY_COLORS[t.priority] ?? ""}>{t.priority}</Badge>
            <Select value={t.status} onValueChange={(v) => updateMut.mutate({ id: t.id, status: v })}>
              <SelectTrigger className={`w-36 ${STATUS_COLORS[t.status] ?? ""}`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="open">Aberto</SelectItem>
                <SelectItem value="pending">Pendente</SelectItem>
                <SelectItem value="resolved">Resolvido</SelectItem>
                <SelectItem value="closed">Encerrado</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="ghost" size="sm" onClick={() => setSelectedId(t.id)}>
              <MessageCircle size={14} className="mr-1" /> Abrir
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Remover ticket"
              onClick={() => {
                if (confirm("Remover ticket?")) deleteMut.mutate(t.id);
              }}
            >
              <Trash2 size={14} className="text-destructive" />
            </Button>
          </div>
        ))}
      </Card>

      {selectedId && <TicketDetailDialog id={selectedId} onClose={() => setSelectedId(null)} />}
    </div>
  );
}

function StatCard({ label, value, accent }: { label: string; value: number; accent?: string }) {
  return (
    <Card className="p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`text-2xl font-bold ${accent ?? ""}`}>{value}</div>
    </Card>
  );
}

function CreateTicketDialog() {
  const qc = useQueryClient();
  const createFn = useServerFn(createTicket);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    subject: "",
    description: "",
    priority: "normal",
    requester_name: "",
    requester_email: "",
    requester_phone: "",
  });

  const mut = useMutation({
    mutationFn: (input: any) => createFn({ data: input }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tickets"] });
      qc.invalidateQueries({ queryKey: ["tickets-stats"] });
      toast.success("Ticket criado");
      setOpen(false);
      setForm({ subject: "", description: "", priority: "normal", requester_name: "", requester_email: "", requester_phone: "" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button><Plus size={14} className="mr-1" /> Novo Ticket</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Novo Ticket</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <Input placeholder="Assunto *" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} />
          <Textarea placeholder="Descrição" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={4} />
          <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="low">Baixa</SelectItem>
              <SelectItem value="normal">Normal</SelectItem>
              <SelectItem value="high">Alta</SelectItem>
              <SelectItem value="urgent">Urgente</SelectItem>
            </SelectContent>
          </Select>
          <Input placeholder="Nome do solicitante" value={form.requester_name} onChange={(e) => setForm({ ...form, requester_name: e.target.value })} />
          <div className="grid grid-cols-2 gap-2">
            <Input placeholder="E-mail" value={form.requester_email} onChange={(e) => setForm({ ...form, requester_email: e.target.value })} />
            <Input placeholder="Telefone" value={form.requester_phone} onChange={(e) => setForm({ ...form, requester_phone: e.target.value })} />
          </div>
        </div>
        <DialogFooter>
          <Button
            disabled={!form.subject || mut.isPending}
            onClick={() => {
              const payload: any = { ...form };
              if (!payload.requester_email) delete payload.requester_email;
              if (!payload.requester_name) delete payload.requester_name;
              if (!payload.requester_phone) delete payload.requester_phone;
              if (!payload.description) delete payload.description;
              mut.mutate(payload);
            }}
          >
            Criar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TicketDetailDialog({ id, onClose }: { id: string; onClose: () => void }) {
  const qc = useQueryClient();
  const getFn = useServerFn(getTicket);
  const addFn = useServerFn(addTicketMessage);
  const { data } = useQuery({ queryKey: ["ticket", id], queryFn: () => getFn({ data: { id } }) });
  const [body, setBody] = useState("");
  const [internal, setInternal] = useState(false);

  const mut = useMutation({
    mutationFn: () => addFn({ data: { ticket_id: id, body, is_internal: internal } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ticket", id] });
      qc.invalidateQueries({ queryKey: ["tickets"] });
      setBody("");
      toast.success("Mensagem enviada");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const ticket = data?.ticket;
  const messages = data?.messages ?? [];

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{ticket?.subject ?? "Carregando..."}</DialogTitle>
        </DialogHeader>
        {ticket && (
          <div className="space-y-4">
            <div className="flex gap-2 text-xs">
              <Badge className={STATUS_COLORS[ticket.status]}>{ticket.status}</Badge>
              <Badge className={PRIORITY_COLORS[ticket.priority]}>{ticket.priority}</Badge>
              {ticket.requester_name && <span className="text-muted-foreground">· {ticket.requester_name}</span>}
            </div>
            {ticket.description && (
              <Card className="p-3 text-sm whitespace-pre-wrap">{ticket.description}</Card>
            )}
            <div className="space-y-2 max-h-72 overflow-auto">
              {messages.map((m: any) => (
                <Card key={m.id} className={`p-3 text-sm ${m.is_internal ? "bg-yellow-500/5 border-yellow-500/20" : ""}`}>
                  <div className="text-xs text-muted-foreground mb-1">
                    {m.is_internal ? "Nota interna" : "Resposta"} · {new Date(m.created_at).toLocaleString("pt-BR")}
                  </div>
                  <div className="whitespace-pre-wrap">{m.body}</div>
                </Card>
              ))}
              {messages.length === 0 && <div className="text-xs text-muted-foreground text-center py-4">Nenhuma mensagem ainda</div>}
            </div>
            <div className="space-y-2 border-t border-border pt-3">
              <Textarea placeholder="Escreva uma resposta..." value={body} onChange={(e) => setBody(e.target.value)} rows={3} />
              <div className="flex items-center justify-between">
                <label className="text-xs flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={internal} onChange={(e) => setInternal(e.target.checked)} />
                  Nota interna (não enviada ao solicitante)
                </label>
                <Button disabled={!body.trim() || mut.isPending} onClick={() => mut.mutate()}>Enviar</Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
