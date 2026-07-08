import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { CheckCircle2, Facebook, Instagram, Search, XCircle, Target } from "lucide-react";
import {
  listAttributedChats, convertChat, rejectChatConversion, type AttributedChat,
} from "@/lib/attributed-leads.functions";
import { updateChatPayment } from "@/lib/charges.functions";

export const Route = createFileRoute("/app/leads/atribuicao")({ component: Page });

function platformIcon(source: string | null) {
  const s = (source ?? "").toLowerCase();
  if (s.includes("ig") || s.includes("insta")) return <Instagram size={14} className="text-pink-500" />;
  if (s.includes("fb") || s.includes("facebook") || s.includes("meta")) return <Facebook size={14} className="text-blue-500" />;
  if (s.includes("google") || s.includes("gads")) return <Search size={14} className="text-yellow-500" />;
  return <Target size={14} className="text-muted-foreground" />;
}

function statusBadge(s: string) {
  if (s === "converted") return <Badge className="bg-emerald-600 hover:bg-emerald-600">Convertido</Badge>;
  if (s === "rejected") return <Badge variant="secondary">Rejeitado</Badge>;
  return <Badge variant="outline">Qualificado</Badge>;
}

function Page() {
  const qc = useQueryClient();
  const list = useServerFn(listAttributedChats);
  const convert = useServerFn(convertChat);
  const reject = useServerFn(rejectChatConversion);

  const [q, setQ] = useState("");
  const query = useQuery({ queryKey: ["attributed-chats"], queryFn: () => list() });

  const convertMut = useMutation({
    mutationFn: (v: { chatId: string; value: number }) => convert({ data: v }),
    onSuccess: () => { toast.success("Purchase enviado ao Meta CAPI."); qc.invalidateQueries({ queryKey: ["attributed-chats"] }); },
    onError: (e: Error) => toast.error(e.message),
  });
  const rejectMut = useMutation({
    mutationFn: (chatId: string) => reject({ data: { chatId } }),
    onSuccess: () => { toast.success("Marcado como rejeitado."); qc.invalidateQueries({ queryKey: ["attributed-chats"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const chats = query.data?.chats ?? [];
  const filtered = useMemo(() => {
    const s = q.toLowerCase();
    return chats.filter(
      (c) => !s ||
        c.name?.toLowerCase().includes(s) ||
        c.phone.toLowerCase().includes(s) ||
        c.first_utm_campaign?.toLowerCase().includes(s) ||
        c.first_utm_content?.toLowerCase().includes(s),
    );
  }, [chats, q]);

  const totals = useMemo(() => {
    const attributed = chats.filter((c) => c.attributed_at).length;
    const converted = chats.filter((c) => c.conversion_status === "converted");
    const revenue = converted.reduce((s, c) => s + (c.conversion_value ?? 0), 0);
    return { total: chats.length, attributed, converted: converted.length, revenue };
  }, [chats]);

  return (
    <div className="p-6 md:p-8 space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold">Leads atribuídos</h1>
        <p className="text-muted-foreground text-sm">
          Cada conversa do WhatsApp com origem rastreada pelo link do anúncio. Confirme a venda para disparar Purchase ao Meta e Google.
        </p>
      </div>

      <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
        <StatCard label="Conversas" value={totals.total} />
        <StatCard label="Atribuídas" value={totals.attributed} />
        <StatCard label="Vendas" value={totals.converted} />
        <StatCard label="Faturamento" value={totals.revenue.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} />
      </div>

      <Input placeholder="Buscar por nome, telefone ou campanha…" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-md" />

      <div className="rounded-md border border-border bg-card overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Data</TableHead>
              <TableHead>Lead</TableHead>
              <TableHead>Origem</TableHead>
              <TableHead>Campanha</TableHead>
              <TableHead>Anúncio</TableHead>
              <TableHead>Valor</TableHead>
              <TableHead>Status</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {query.isLoading && (
              <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">Carregando…</TableCell></TableRow>
            )}
            {!query.isLoading && filtered.length === 0 && (
              <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                Nenhuma conversa ainda. Gere um link rastreado do WhatsApp para começar a atribuir leads.
              </TableCell></TableRow>
            )}
            {filtered.map((c) => (
              <Row key={c.id} chat={c}
                onConvert={(v) => convertMut.mutate({ chatId: c.id, value: v })}
                onReject={() => rejectMut.mutate(c.id)}
                pending={convertMut.isPending || rejectMut.isPending}
              />
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-xs text-muted-foreground uppercase tracking-wide">{label}</div>
        <div className="text-xl font-bold mt-1">{value}</div>
      </CardContent>
    </Card>
  );
}

function Row({ chat, onConvert, onReject, pending }: {
  chat: AttributedChat; onConvert: (v: number) => void; onReject: () => void; pending: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [val, setVal] = useState("");
  const attributed = Boolean(chat.attributed_at);

  return (
    <TableRow>
      <TableCell className="text-xs text-muted-foreground">
        {new Date(chat.created_at).toLocaleDateString("pt-BR")}<br />
        <span className="opacity-60">{new Date(chat.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span>
      </TableCell>
      <TableCell>
        <div className="font-medium text-sm">{chat.name ?? "—"}</div>
        <div className="text-xs text-muted-foreground">{chat.phone}</div>
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-1 text-xs">
          {platformIcon(chat.first_utm_source)}
          <span>{chat.first_utm_source ?? (attributed ? "direct" : "—")}</span>
        </div>
      </TableCell>
      <TableCell className="text-xs max-w-[180px] truncate" title={chat.first_utm_campaign ?? ""}>
        {chat.first_utm_campaign ?? "—"}
      </TableCell>
      <TableCell className="text-xs max-w-[180px] truncate" title={chat.first_utm_content ?? ""}>
        {chat.first_utm_content ?? "—"}
      </TableCell>
      <TableCell className="text-xs">
        {chat.conversion_value != null
          ? chat.conversion_value.toLocaleString("pt-BR", { style: "currency", currency: chat.conversion_currency ?? "BRL" })
          : "—"}
      </TableCell>
      <TableCell>{statusBadge(chat.conversion_status)}</TableCell>
      <TableCell className="text-right">
        {chat.conversion_status === "pending" && attributed && (
          <div className="flex gap-1 justify-end">
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button size="sm" disabled={pending}>
                  <CheckCircle2 size={14} className="mr-1" /> Converter
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Registrar venda</DialogTitle>
                </DialogHeader>
                <div className="space-y-2">
                  <label className="text-sm">Valor (R$)</label>
                  <Input type="number" step="0.01" min="0" value={val} onChange={(e) => setVal(e.target.value)} placeholder="Ex: 297.00" autoFocus />
                  <p className="text-xs text-muted-foreground">
                    Vai disparar um evento <strong>Purchase</strong> ao Meta CAPI e uma conversão offline ao Google Ads usando os identificadores da atribuição original.
                  </p>
                </div>
                <DialogFooter>
                  <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
                  <Button
                    onClick={() => {
                      const v = Number(val);
                      if (!Number.isFinite(v) || v <= 0) { toast.error("Informe um valor válido."); return; }
                      onConvert(v);
                      setOpen(false);
                      setVal("");
                    }}
                    disabled={pending}
                  >Confirmar e enviar</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            <Button size="sm" variant="ghost" onClick={onReject} disabled={pending} aria-label="Rejeitar">
              <XCircle size={14} />
            </Button>
          </div>
        )}
      </TableCell>
    </TableRow>
  );
}
