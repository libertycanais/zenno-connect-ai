import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowDownCircle, ArrowUpCircle, Wallet, Clock } from "lucide-react";
import { getFinanceSummary } from "@/lib/finance.functions";

export const Route = createFileRoute("/app/financeiro/")({
  component: FinanceDashboard,
});

function fmt(n: number) {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function FinanceDashboard() {
  const fn = useServerFn(getFinanceSummary);
  const { data, isLoading } = useQuery({ queryKey: ["finance-summary"], queryFn: () => fn() });

  if (isLoading || !data) return <p className="text-sm text-muted-foreground">Carregando…</p>;

  const balance = data.income_paid - data.expense_paid;
  const cards = [
    { label: "Receitas pagas (mês)", value: fmt(data.income_paid), icon: ArrowUpCircle, color: "text-emerald-500" },
    { label: "Despesas pagas (mês)", value: fmt(data.expense_paid), icon: ArrowDownCircle, color: "text-destructive" },
    { label: "Saldo do mês", value: fmt(balance), icon: Wallet, color: balance >= 0 ? "text-emerald-500" : "text-destructive" },
    { label: "A receber + a pagar", value: fmt(data.income_pending + data.expense_pending), icon: Clock, color: "text-amber-500" },
  ];

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => {
          const Icon = c.icon;
          return (
            <Card key={c.label}>
              <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{c.label}</CardTitle>
                <Icon className={c.color} size={18} />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{c.value}</div>
              </CardContent>
            </Card>
          );
        })}
      </div>
      <Card>
        <CardHeader><CardTitle className="text-base">Pendências do mês</CardTitle></CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          <div className="rounded-md border border-border p-4">
            <div className="text-xs text-muted-foreground">Receitas pendentes</div>
            <div className="text-xl font-semibold text-emerald-500">{fmt(data.income_pending)}</div>
          </div>
          <div className="rounded-md border border-border p-4">
            <div className="text-xs text-muted-foreground">Despesas pendentes</div>
            <div className="text-xl font-semibold text-destructive">{fmt(data.expense_pending)}</div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
