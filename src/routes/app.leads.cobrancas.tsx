import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlarmClock, CheckCircle2 } from "lucide-react";
import { listChargesDue, markReminderSent } from "@/lib/charges.functions";

export const Route = createFileRoute("/app/leads/cobrancas")({ component: Page });

const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function modeLabel(m: string | null) {
  if (m === "upfront") return "Antecipado";
  if (m === "cod") return "Na entrega";
  if (m === "postpaid") return "Pós-entrega";
  return "—";
}

function Page() {
  const qc = useQueryClient();
  const list = useServerFn(listChargesDue);
  const mark = useServerFn(markReminderSent);
  const q = useQuery({ queryKey: ["charges-due"], queryFn: () => list() });

  const markMut = useMutation({
    mutationFn: (chatId: string) => mark({ data: { chatId } }),
    onSuccess: () => { toast.success("Marcado como lembrado."); qc.invalidateQueries({ queryKey: ["charges-due"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const rows = q.data?.rows ?? [];
  const overdue = rows.filter((r) => r.overdue).length;
  const today = rows.filter((r) => !r.overdue).length;

  return (
    <div className="p-6 md:p-8 space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold">Cobranças de hoje</h1>
        <p className="text-muted-foreground text-sm">
          Conversas com modalidade definida cuja data de cobrança chegou. Mande a mensagem e marque como lembrado.
        </p>
      </div>

      <div className="grid gap-3 grid-cols-2 md:grid-cols-3">
        <Stat label="Total pendente" value={rows.length} />
        <Stat label="Vencidas" value={overdue} tone="destructive" />
        <Stat label="Hoje" value={today} />
      </div>

      <div className="rounded-md border border-border bg-card overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Cliente</TableHead>
              <TableHead>Telefone</TableHead>
              <TableHead>Modalidade</TableHead>
              <TableHead>Vence em</TableHead>
              <TableHead>Valor</TableHead>
              <TableHead>Última mensagem</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {q.isLoading && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Carregando…</TableCell></TableRow>}
            {!q.isLoading && rows.length === 0 && (
              <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                Nada pra cobrar agora. Defina modalidade e data de cobrança nas conversas em <strong>/app/leads/atribuicao</strong>.
              </TableCell></TableRow>
            )}
            {rows.map((r) => (
              <TableRow key={r.id} className={r.overdue ? "bg-destructive/5" : ""}>
                <TableCell className="font-medium">{r.name ?? "—"}</TableCell>
                <TableCell className="text-xs">{r.phone}</TableCell>
                <TableCell><Badge variant="outline">{modeLabel(r.payment_mode)}</Badge></TableCell>
                <TableCell className="text-xs">
                  {r.overdue && <AlarmClock size={12} className="inline mr-1 text-destructive" />}
                  {new Date(r.due_at!).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                </TableCell>
                <TableCell className="text-xs">{r.conversion_value != null ? brl(r.conversion_value) : "—"}</TableCell>
                <TableCell className="text-xs text-muted-foreground max-w-[240px] truncate">{r.last_message_preview ?? "—"}</TableCell>
                <TableCell className="text-right">
                  <Button size="sm" variant="secondary" disabled={markMut.isPending} onClick={() => markMut.mutate(r.id)}>
                    <CheckCircle2 size={14} className="mr-1" /> Lembrei
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string | number; tone?: "destructive" }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-xs text-muted-foreground uppercase tracking-wide">{label}</div>
        <div className={`text-xl font-bold mt-1 ${tone === "destructive" ? "text-destructive" : ""}`}>{value}</div>
      </CardContent>
    </Card>
  );
}
