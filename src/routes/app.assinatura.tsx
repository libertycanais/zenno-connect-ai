import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, Sparkles, Clock } from "lucide-react";
import { getSubscription, changePlan } from "@/lib/subscription.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/app/assinatura")({ component: AssinaturaPage });

const FEATURES_BASICO = ["Conexão com WhatsApp", "Módulo Financeiro", "Integração Sigma", "Leads ilimitados"];
const FEATURES_COMPLETO = [
  "Tudo do plano Básico",
  "Meta Ads & Google Ads",
  "Pipeline / Kanban avançado",
  "Automações ilimitadas",
  "Agente IA para qualificação",
  "Tickets / Suporte",
  "Integrações com bancos (Asaas, Mercado Pago)",
];

function AssinaturaPage() {
  const qc = useQueryClient();
  const fetchSub = useServerFn(getSubscription);
  const changeFn = useServerFn(changePlan);
  const { data, isLoading } = useQuery({ queryKey: ["subscription"], queryFn: () => fetchSub() });
  const mut = useMutation({
    mutationFn: (plan: string) => changeFn({ data: { plan } }),
    onSuccess: () => {
      toast.success("Plano atualizado");
      qc.invalidateQueries({ queryKey: ["subscription"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao alterar plano"),
  });

  const sub = data?.subscription;
  const trialDays = sub?.trial_ends_at
    ? Math.max(0, Math.ceil((new Date(sub.trial_ends_at).getTime() - Date.now()) / (24 * 3600 * 1000)))
    : 0;

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold">Assinatura</h1>
        <p className="text-muted-foreground">Gerencie seu plano e período de teste</p>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">Carregando…</p>
      ) : (
        <>
          <Card className="border-primary/40 bg-gradient-to-r from-primary/10 to-accent/5">
            <CardHeader>
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-primary" />
                    Plano atual: <span className="capitalize">{sub?.plan}</span>
                  </CardTitle>
                  <CardDescription>
                    Status: <Badge variant="outline">{sub?.status}</Badge>
                  </CardDescription>
                </div>
                {sub?.plan === "trial" && (
                  <div className="flex items-center gap-2 text-sm">
                    <Clock className="h-4 w-4" />
                    <span className="font-semibold">{trialDays} dias restantes</span>
                  </div>
                )}
                {sub?.current_period_end && sub?.plan !== "trial" && (
                  <div className="text-sm text-muted-foreground">
                    Renova em {new Date(sub.current_period_end).toLocaleDateString("pt-BR")}
                  </div>
                )}
              </div>
            </CardHeader>
          </Card>

          <div className="grid md:grid-cols-2 gap-6">
            <PlanCard
              name="Básico"
              price="R$ 29,99"
              features={FEATURES_BASICO}
              current={sub?.plan === "basico"}
              onSelect={() => mut.mutate("basico")}
              loading={mut.isPending}
            />
            <PlanCard
              name="Completo"
              price="R$ 69,99"
              features={FEATURES_COMPLETO}
              highlight
              current={sub?.plan === "completo"}
              onSelect={() => mut.mutate("completo")}
              loading={mut.isPending}
            />
          </div>

          {sub?.plan !== "trial" && sub?.plan !== "cancelado" && (
            <div className="text-center">
              <Button variant="ghost" size="sm" onClick={() => mut.mutate("cancelado")} disabled={mut.isPending}>
                Cancelar assinatura
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function PlanCard({
  name, price, features, highlight, current, onSelect, loading,
}: {
  name: string; price: string; features: string[]; highlight?: boolean;
  current?: boolean; onSelect: () => void; loading: boolean;
}) {
  return (
    <Card className={highlight ? "border-primary shadow-lg shadow-primary/20" : ""}>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          {name}
          {highlight && <Badge className="bg-primary">Recomendado</Badge>}
        </CardTitle>
        <div className="text-3xl font-bold mt-2">
          {price}<span className="text-sm font-normal text-muted-foreground">/mês</span>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <ul className="space-y-2">
          {features.map((f) => (
            <li key={f} className="flex items-start gap-2 text-sm">
              <Check className="h-4 w-4 text-primary mt-0.5 shrink-0" />
              <span>{f}</span>
            </li>
          ))}
        </ul>
        <Button className="w-full" variant={highlight ? "default" : "outline"} disabled={current || loading} onClick={onSelect}>
          {current ? "Plano ativo" : loading ? "Processando…" : `Assinar ${name}`}
        </Button>
      </CardContent>
    </Card>
  );
}
