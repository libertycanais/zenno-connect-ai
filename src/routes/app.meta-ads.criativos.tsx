import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { listCreatives } from "@/lib/creatives.functions";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

export const Route = createFileRoute("/app/meta-ads/criativos")({ component: Page });

const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function roasBadge(roas: number | null) {
  if (roas == null) return <Badge variant="outline">—</Badge>;
  if (roas >= 2) return <Badge className="bg-emerald-600 hover:bg-emerald-600"><TrendingUp size={12} className="mr-1" />{roas.toFixed(2)}x</Badge>;
  if (roas >= 1) return <Badge className="bg-amber-500 hover:bg-amber-500"><Minus size={12} className="mr-1" />{roas.toFixed(2)}x</Badge>;
  return <Badge variant="destructive"><TrendingDown size={12} className="mr-1" />{roas.toFixed(2)}x</Badge>;
}

function Page() {
  const list = useServerFn(listCreatives);
  const q = useQuery({ queryKey: ["creatives"], queryFn: () => list() });
  const rows = q.data?.rows ?? [];

  const totals = rows.reduce(
    (a, r) => ({
      spend: a.spend + r.spend,
      leads: a.leads + r.leads,
      sales: a.sales + r.sales,
      revenue: a.revenue + r.revenue,
    }),
    { spend: 0, leads: 0, sales: 0, revenue: 0 },
  );

  return (
    <div className="p-6 md:p-8 space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold">ROI por criativo</h1>
        <p className="text-muted-foreground text-sm">
          Cruza o gasto de anúncio do Meta com os leads e vendas do WhatsApp atribuídos por CTWA. Corte o que só queima dinheiro.
        </p>
      </div>

      <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
        <Stat label="Gasto" value={brl(totals.spend)} />
        <Stat label="Leads" value={totals.leads} />
        <Stat label="Vendas" value={totals.sales} />
        <Stat label="Faturamento" value={brl(totals.revenue)} />
      </div>

      <div className="rounded-md border border-border bg-card overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Anúncio</TableHead>
              <TableHead>Campanha</TableHead>
              <TableHead className="text-right">Gasto</TableHead>
              <TableHead className="text-right">Impr.</TableHead>
              <TableHead className="text-right">Cliques</TableHead>
              <TableHead className="text-right">Leads</TableHead>
              <TableHead className="text-right">Vendas</TableHead>
              <TableHead className="text-right">CPL</TableHead>
              <TableHead className="text-right">CPA</TableHead>
              <TableHead className="text-right">ROAS</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {q.isLoading && (
              <TableRow><TableCell colSpan={10} className="text-center text-muted-foreground py-8">Carregando…</TableCell></TableRow>
            )}
            {!q.isLoading && rows.length === 0 && (
              <TableRow><TableCell colSpan={10} className="text-center text-muted-foreground py-8">
                Sem dados ainda. Sincronize insights do Meta em <strong>/app/meta-ads</strong> e capture leads via link CTWA rastreado.
              </TableCell></TableRow>
            )}
            {rows.map((r) => (
              <TableRow key={r.key}>
                <TableCell>
                  <div className="text-sm font-medium max-w-[240px] truncate" title={r.ad_name ?? r.key}>
                    {r.ad_name ?? r.key}
                  </div>
                  {r.adset_name && <div className="text-xs text-muted-foreground truncate max-w-[240px]">{r.adset_name}</div>}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground max-w-[180px] truncate" title={r.campaign_name ?? ""}>
                  {r.campaign_name ?? "—"}
                </TableCell>
                <TableCell className="text-right text-sm">{brl(r.spend)}</TableCell>
                <TableCell className="text-right text-xs text-muted-foreground">{r.impressions.toLocaleString("pt-BR")}</TableCell>
                <TableCell className="text-right text-xs text-muted-foreground">{r.clicks.toLocaleString("pt-BR")}</TableCell>
                <TableCell className="text-right text-sm">{r.leads}</TableCell>
                <TableCell className="text-right text-sm font-medium">{r.sales}</TableCell>
                <TableCell className="text-right text-xs">{r.cpl != null ? brl(r.cpl) : "—"}</TableCell>
                <TableCell className="text-right text-xs">{r.cpa != null ? brl(r.cpa) : "—"}</TableCell>
                <TableCell className="text-right">{roasBadge(r.roas)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-xs text-muted-foreground uppercase tracking-wide">{label}</div>
        <div className="text-xl font-bold mt-1">{value}</div>
      </CardContent>
    </Card>
  );
}
