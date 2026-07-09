import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  exportExecutiveReport,
  getExecutiveSnapshot,
} from "@/lib/executive-dashboard.functions";

export const Route = createFileRoute("/app/executivo")({ component: ExecutiveDashboard });

function ExecutiveDashboard() {
  const [days, setDays] = useState(30);
  const fetchSnap = useServerFn(getExecutiveSnapshot);
  const doExport = useServerFn(exportExecutiveReport);
  const { data, isLoading } = useQuery({
    queryKey: ["executive-snapshot", days],
    queryFn: () => fetchSnap({ data: { days } as never }),
    staleTime: 60_000,
  });

  async function download(format: "csv" | "xlsx" | "json") {
    const r = await doExport({ data: { format, days } as never });
    const blob = new Blob([r.content], { type: r.mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = r.filename; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="p-6 md:p-8 max-w-7xl space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <h1 className="text-2xl md:text-3xl font-bold">Dashboard Executivo</h1>
        <div className="flex gap-2">
          {[7, 30, 90].map((d) => (
            <Button key={d} size="sm" variant={days === d ? "default" : "outline"} onClick={() => setDays(d)}>
              {d}d
            </Button>
          ))}
          <Button size="sm" variant="outline" onClick={() => download("csv")}>CSV</Button>
          <Button size="sm" variant="outline" onClick={() => download("xlsx")}>Excel</Button>
          <Button size="sm" variant="outline" onClick={() => download("json")}>JSON</Button>
        </div>
      </div>

      {isLoading || !data ? (
        <div className="text-sm text-muted-foreground">Carregando…</div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <KPI label="MRR" value={fmtMoney(data.billing.mrr)} />
            <KPI label="ARR" value={fmtMoney(data.billing.arr)} />
            <KPI label="Clientes ativos" value={String(data.billing.active)} />
            <KPI label="Em trial" value={String(data.billing.trialing)} />
            <KPI label="Churn 30d" value={fmtPct(data.billing.churnRate)} />
            <KPI label="Ticket médio" value={fmtMoney(data.billing.ticketMedio)} />
            <KPI label="CAC" value={fmtMoney(data.economics.cac)} />
            <KPI label="LTV" value={fmtMoney(data.economics.ltv)} />
            <KPI label="ROI" value={fmtPct(data.economics.roi)} />
            <KPI label="Conversão" value={fmtPct(data.acquisition.conversionRate)} />
            <KPI label="Leads" value={String(data.acquisition.leads)} />
            <KPI label="Convites pend." value={String(data.organization.pending_invitations)} />
          </div>

          <Tabs defaultValue="trends">
            <TabsList>
              <TabsTrigger value="trends">Tendências</TabsTrigger>
              <TabsTrigger value="funnel">Funil</TabsTrigger>
              <TabsTrigger value="sources">Origens</TabsTrigger>
            </TabsList>

            <TabsContent value="trends">
              <Card>
                <CardHeader><CardTitle>Receita & Leads ({days}d)</CardTitle></CardHeader>
                <CardContent className="h-80">
                  <ResponsiveContainer>
                    <LineChart data={data.daily}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" fontSize={11} />
                      <YAxis fontSize={11} />
                      <Tooltip />
                      <Line type="monotone" dataKey="leads" stroke="hsl(var(--primary))" />
                      <Line type="monotone" dataKey="revenue" stroke="hsl(var(--chart-2, 200 80% 50%))" />
                      <Line type="monotone" dataKey="conversions" stroke="hsl(var(--chart-3, 30 90% 55%))" />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="funnel">
              <Card>
                <CardHeader><CardTitle>Funil de conversão</CardTitle></CardHeader>
                <CardContent className="h-80">
                  <ResponsiveContainer>
                    <BarChart data={data.funnel}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="stage" fontSize={11} />
                      <YAxis fontSize={11} />
                      <Tooltip />
                      <Bar dataKey="count" fill="hsl(var(--primary))" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="sources">
              <Card>
                <CardHeader><CardTitle>Origens (UTM)</CardTitle></CardHeader>
                <CardContent className="h-80">
                  <ResponsiveContainer>
                    <BarChart data={data.sources}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="source" fontSize={11} />
                      <YAxis fontSize={11} />
                      <Tooltip />
                      <Bar dataKey="count" fill="hsl(var(--primary))" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
}

function KPI({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{label}</CardTitle></CardHeader>
      <CardContent><div className="text-2xl font-bold">{value}</div></CardContent>
    </Card>
  );
}

function fmtMoney(n: number): string {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
function fmtPct(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}
