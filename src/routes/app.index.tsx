import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid,
  PieChart, Pie, Cell, Legend,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Users, TrendingUp, CheckCircle2, Repeat, DollarSign, Ticket,
  AlertCircle, Plug, ArrowRight,
} from "lucide-react";
import { getDashboardStats } from "@/lib/dashboard.functions";

export const Route = createFileRoute("/app/")({ component: Dashboard });

const STATUS_COLORS = ["oklch(0.72 0.18 235)", "oklch(0.65 0.2 200)", "oklch(0.78 0.15 220)", "oklch(0.55 0.22 260)", "oklch(0.7 0.16 190)"];

function fmtBRL(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
function fmtDay(d: string) {
  const [, m, day] = d.split("-");
  return `${day}/${m}`;
}

function Dashboard() {
  const fetchStats = useServerFn(getDashboardStats);
  const { data, isLoading } = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: () => fetchStats({ data: undefined as any }),
  });

  const counts = data?.counts ?? { total: 0, novos: 0, clientes: 0, renovacoes: 0, qualificado: 0, perdido: 0 };
  const finance = data?.finance ?? { receita: 0, despesa: 0, saldo: 0 };
  const days = data?.days ?? [];
  const integrations = data?.integrations ?? [];
  const tickets = data?.tickets ?? { total: 0, abertos: 0 };

  const disconnected = integrations.filter((i) => !i.connected);

  const stats = [
    { label: "Total de Leads", value: counts.total, icon: Users, accent: "text-primary" },
    { label: "Novos Leads", value: counts.novos, icon: TrendingUp, accent: "text-accent" },
    { label: "Clientes", value: counts.clientes, icon: CheckCircle2, accent: "text-emerald-400" },
    { label: "Renovações", value: counts.renovacoes, icon: Repeat, accent: "text-primary" },
    { label: "Saldo 14d", value: fmtBRL(finance.saldo), icon: DollarSign, accent: finance.saldo >= 0 ? "text-emerald-400" : "text-destructive" },
    { label: "Tickets abertos", value: tickets.abertos, icon: Ticket, accent: "text-accent" },
  ];

  const pieData = [
    { name: "Novos", value: counts.novos },
    { name: "Qualificado", value: counts.qualificado },
    { name: "Clientes", value: counts.clientes },
    { name: "Renovações", value: counts.renovacoes },
    { name: "Perdido", value: counts.perdido },
  ].filter((d) => d.value > 0);

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-7xl mx-auto">
      <header>
        <h1 className="text-2xl md:text-3xl font-bold mb-1">Dashboard</h1>
        <p className="text-muted-foreground text-sm">Visão geral da sua operação nos últimos 14 dias</p>
      </header>

      {disconnected.length > 0 && (
        <Card className="border-amber-500/40 bg-amber-500/5">
          <CardContent className="p-4">
            <div className="flex items-start gap-3 flex-wrap">
              <AlertCircle className="text-amber-400 mt-0.5 shrink-0" size={20} />
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-sm">
                  {disconnected.length} integraç{disconnected.length === 1 ? "ão desconectada" : "ões desconectadas"}
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Conecte para começar a receber dados nessas áreas.
                </p>
                <div className="flex flex-wrap gap-2 mt-3">
                  {disconnected.map((i) => (
                    <Button key={i.key} asChild size="sm" variant="outline" className="h-7 text-xs">
                      <Link to={i.href}>
                        <Plug size={12} className="mr-1.5" /> Conectar {i.label}
                      </Link>
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {stats.map(({ label, value, icon: Icon, accent }) => (
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
            <CardTitle className="text-base">Leads por dia</CardTitle>
          </CardHeader>
          <CardContent className="h-64">
            {isLoading || days.length === 0 ? (
              <EmptyChart />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={days} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gLeads" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="oklch(0.72 0.18 235)" stopOpacity={0.6} />
                      <stop offset="95%" stopColor="oklch(0.72 0.18 235)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="oklch(1 0 0 / 8%)" />
                  <XAxis dataKey="date" tickFormatter={fmtDay} stroke="oklch(0.72 0.04 230)" fontSize={11} />
                  <YAxis allowDecimals={false} stroke="oklch(0.72 0.04 230)" fontSize={11} />
                  <Tooltip
                    contentStyle={{ background: "oklch(0.19 0.04 250)", border: "1px solid oklch(0.72 0.18 235 / 30%)", borderRadius: 8 }}
                    labelFormatter={fmtDay}
                  />
                  <Area type="monotone" dataKey="leads" stroke="oklch(0.72 0.18 235)" fill="url(#gLeads)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Funil de leads</CardTitle>
          </CardHeader>
          <CardContent className="h-64">
            {pieData.length === 0 ? (
              <EmptyChart />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={45} outerRadius={75} paddingAngle={2}>
                    {pieData.map((_, i) => <Cell key={i} fill={STATUS_COLORS[i % STATUS_COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ background: "oklch(0.19 0.04 250)", border: "1px solid oklch(0.72 0.18 235 / 30%)", borderRadius: 8 }} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Financeiro — Receita vs Despesa (14d)</CardTitle>
          </CardHeader>
          <CardContent className="h-64">
            {days.length === 0 ? (
              <EmptyChart />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={days} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gReceita" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="oklch(0.7 0.18 150)" stopOpacity={0.6} />
                      <stop offset="95%" stopColor="oklch(0.7 0.18 150)" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gDespesa" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="oklch(0.65 0.22 25)" stopOpacity={0.6} />
                      <stop offset="95%" stopColor="oklch(0.65 0.22 25)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="oklch(1 0 0 / 8%)" />
                  <XAxis dataKey="date" tickFormatter={fmtDay} stroke="oklch(0.72 0.04 230)" fontSize={11} />
                  <YAxis stroke="oklch(0.72 0.04 230)" fontSize={11} tickFormatter={(v) => `R$${v}`} />
                  <Tooltip
                    contentStyle={{ background: "oklch(0.19 0.04 250)", border: "1px solid oklch(0.72 0.18 235 / 30%)", borderRadius: 8 }}
                    labelFormatter={fmtDay}
                    formatter={(v: any) => fmtBRL(Number(v))}
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Area type="monotone" dataKey="receita" name="Receita" stroke="oklch(0.7 0.18 150)" fill="url(#gReceita)" strokeWidth={2} />
                  <Area type="monotone" dataKey="despesa" name="Despesa" stroke="oklch(0.65 0.22 25)" fill="url(#gDespesa)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Plug size={16} className="text-primary" /> Integrações
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {integrations.length === 0 ? (
              <p className="text-sm text-muted-foreground">Carregando…</p>
            ) : (
              integrations.map((i) => (
                <Link
                  key={i.key}
                  to={i.href}
                  className="flex items-center justify-between gap-2 rounded-lg border border-border/60 px-3 py-2 hover:bg-muted/30 transition-colors group"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className={`h-2 w-2 rounded-full shrink-0 ${i.connected ? "bg-emerald-400 shadow-[0_0_6px] shadow-emerald-400/60" : "bg-muted-foreground/40"}`}
                    />
                    <span className="text-sm truncate">{i.label}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {i.connected ? (
                      <Badge variant="secondary" className="text-[10px] h-5">Conectado</Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px] h-5 border-amber-500/50 text-amber-400">Desconectado</Badge>
                    )}
                    <ArrowRight size={14} className="text-muted-foreground group-hover:translate-x-0.5 transition-transform" />
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

function EmptyChart() {
  return (
    <div className="h-full grid place-items-center text-xs text-muted-foreground">
      Sem dados no período
    </div>
  );
}
