import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useLeads, useDeleteLead } from "@/modules/crm/useLeads";
import { LEAD_STATUSES } from "@/modules/crm/leadStatus";
import { NewLeadDialog } from "@/modules/crm/NewLeadDialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/leads/")({ component: LeadsList });

function LeadsList() {
  const { data: leads, isLoading } = useLeads();
  const del = useDeleteLead();
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const s = q.toLowerCase();
    return (leads ?? []).filter(
      (l) => !s || l.name.toLowerCase().includes(s) || l.email?.toLowerCase().includes(s) || l.phone?.toLowerCase().includes(s),
    );
  }, [leads, q]);

  return (
    <div className="p-6 md:p-8">
      <div className="flex flex-wrap gap-3 items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Leads</h1>
          <p className="text-muted-foreground text-sm">Gestão completa dos seus leads</p>
        </div>
        <NewLeadDialog />
      </div>
      <Input placeholder="Buscar por nome, email ou telefone..." value={q} onChange={(e) => setQ(e.target.value)} className="mb-4 max-w-md" />
      <div className="rounded-md border border-border bg-card overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Contato</TableHead>
              <TableHead>Origem</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Criado</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">Carregando...</TableCell></TableRow>}
            {!isLoading && filtered.length === 0 && (
              <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Nenhum lead encontrado</TableCell></TableRow>
            )}
            {filtered.map((l) => (
              <TableRow key={l.id}>
                <TableCell className="font-medium">{l.name}</TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  <div>{l.phone}</div><div>{l.email}</div>
                </TableCell>
                <TableCell className="text-sm">{l.source ?? "-"}</TableCell>
                <TableCell>
                  <Badge variant="secondary">{LEAD_STATUSES.find((s) => s.id === l.status)?.label ?? l.status}</Badge>
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">{new Date(l.created_at).toLocaleDateString("pt-BR")}</TableCell>
                <TableCell>
                  <Button variant="ghost" size="icon" onClick={async () => {
                    if (!confirm("Excluir este lead?")) return;
                    try { await del.mutateAsync(l.id); toast.success("Lead excluído"); }
                    catch (e: any) { toast.error(e.message); }
                  }}>
                    <Trash2 size={14} />
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
