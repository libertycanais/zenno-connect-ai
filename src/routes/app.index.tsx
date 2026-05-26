import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, TrendingUp, CheckCircle2, Repeat } from "lucide-react";

export const Route = createFileRoute("/app/")({ component: Dashboard });

function Dashboard() {
  const { data } = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: async () => {
      const { data: leads } = await supabase.from("leads").select("status");
      const all = leads ?? [];
      return {
        total: all.length,
        novos: all.filter((l) => l.status === "novo").length,
        clientes: all.filter((l) => l.status === "cliente").length,
        renovacoes: all.filter((l) => l.status === "renovacao").length,
      };
    },
  });

  const stats = [
    { label: "Total de Leads", value: data?.total ?? 0, icon: Users },
    { label: "Novos Leads", value: data?.novos ?? 0, icon: TrendingUp },
    { label: "Clientes", value: data?.clientes ?? 0, icon: CheckCircle2 },
    { label: "Renovações", value: data?.renovacoes ?? 0, icon: Repeat },
  ];

  return (
    <div className="p-6 md:p-8">
      <h1 className="text-2xl md:text-3xl font-bold mb-1">Dashboard</h1>
      <p className="text-muted-foreground mb-6">Visão geral da sua operação</p>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map(({ label, value, icon: Icon }) => (
          <Card key={label}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
              <Icon size={18} className="text-primary" />
            </CardHeader>
            <CardContent><div className="text-3xl font-bold">{value}</div></CardContent>
          </Card>
        ))}
      </div>
      <Card className="mt-6">
        <CardHeader><CardTitle>Bem-vindo ao ZENNO CRM AI</CardTitle></CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>Fase 1 (Fundação + CRM) está pronta. Os módulos marcados como "soon" estão no roadmap.</p>
          <p>Próximas fases: WhatsApp/Uazapi, Meta Ads, Google Ads, Sigma, Financeiro, Automações e IA.</p>
        </CardContent>
      </Card>
    </div>
  );
}
