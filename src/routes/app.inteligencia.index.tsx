import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid,
} from "recharts";
import { getIntelligenceWidgets } from "@/lib/experts-analytics.functions";
import { Sparkles, CheckCircle2, DollarSign, TrendingUp, AlertTriangle, Activity } from "lucide-react";

export const Route = createFileRoute("/app/inteligencia/")({ component: IntelligenceOverview });

function fmtBRL(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function IntelligenceOverview() {
  const fetch = useServerFn(getIntelligenceWidgets);
  const { data, isLoading } = useQuery({
    queryKey: ["intel-widgets"],
    queryFn: () => fetch({ data: undefined as never }),
  });

  const w = data;
  const cards = [
    { label: "Recomendações abertas", value: w?.totals.open ?? 0, icon: Sparkles, accent: "text-primary" },
    { label: "Concluídas", value: w?.totals.resolved ?? 0, icon: CheckCircle2, accent: "text-emerald-400" },
    { label: "ROI estimado", value: fmtBRL(w?.financial.estimatedRoiCents ?? 0), icon: DollarSign, accent: "text-accent" },
    { label: "Oportunidades", value: (w?.totals.open ?? 0) + (w?.totals.inProgress ?? 0), icon: TrendingUp, accent: "text-primary" },
    { label: "Confiança média", value: `${Math.round((w?.quality.avgConfidence ?? 0) * 100)}%`, icon: Activity, accent: "text-accent" },
    { label: "Críticas", value: w?.quality.criticalCount ?? 0, icon: AlertTriangle, accent: "text-destructive" },
  ];

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {cards.map(({ label, value, icon: Icon, accent }) => (
          <Card key={label}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-muted-foreground line-clamp-1">{label}</span>
                <Icon size={16} className={accent} />
              </div>
              <div className="text-xl md:text-2xl font-bold tracking-tight">{value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Evolução — Recomendações (14d)</CardTitle>
          </CardHeader>
          <CardContent className="h-64">
            {isLoading || !w ? (
              <div className="h-full grid place-items-center text-xs text-muted-foreground">Carregando…</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={w.timeline}>
                  <defs>
                    <linearGradient id="gCreated" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="oklch(0.72 0.18 235)" stopOpacity={0.6} />
                      <stop offset="95%" stopColor="oklch(0.72 0.18 235)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="oklch(1 0 0 / 8%)" />
                  <XAxis dataKey="date" stroke="oklch(0.72 0.04 230)" fontSize={11} />
                  <YAxis allowDecimals={false} stroke="oklch(0.72 0.04 230)" fontSize={11} />
                  <Tooltip contentStyle={{ background: "oklch(0.19 0.04 250)", border: "1px solid oklch(0.72 0.18 235 / 30%)", borderRadius: 8 }} />
                  <Area type="monotone" dataKey="created" name="Criadas" stroke="oklch(0.72 0.18 235)" fill="url(#gCreated)" strokeWidth={2} />
                  <Area type="monotone" dataKey="resolved" name="Resolvidas" stroke="oklch(0.7 0.18 150)" fill="oklch(0.7 0.18 150 / 15%)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Top oportunidades abertas</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {(w?.topOpen ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma oportunidade em aberto.</p>
            ) : (
              w!.topOpen.map((r) => (
                <Link
                  key={r.id} to="/app/inteligencia/recomendacoes/$id" params={{ id: r.id }}
                  className="block rounded-lg border border-border/60 p-3 hover:bg-muted/30 transition-colors"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium truncate">{r.summary}</span>
                    <Badge variant="outline" className="text-[10px] h-5 shrink-0">{r.urgency}</Badge>
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground mt-1">
                    <span>Conf. {Math.round(r.confidence * 100)}%</span>
                    <span>{fmtBRL(r.financialValueCents)}</span>
                  </div>
                </Link>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
