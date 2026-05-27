import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { getSystemHealth } from "@/lib/admin.functions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, AlertTriangle, CheckCircle2, XCircle, Clock } from "lucide-react";

export const Route = createFileRoute("/app/admin/")({
  component: AdminDashboard,
});

function HealthDot({ h }: { h: string }) {
  const map: Record<string, { c: string; I: any }> = {
    ok: { c: "text-emerald-500", I: CheckCircle2 },
    warning: { c: "text-amber-500", I: AlertTriangle },
    error: { c: "text-red-500", I: XCircle },
    expired: { c: "text-red-500", I: XCircle },
    unknown: { c: "text-muted-foreground", I: Clock },
  };
  const { c, I } = map[h] ?? map.unknown;
  return <I size={14} className={c} />;
}

function Stat({ label, value, hint }: { label: string; value: number | string; hint?: string }) {
  return (
    <Card className="p-4">
      <div className="text-xs text-muted-foreground uppercase tracking-wide">{label}</div>
      <div className="text-2xl font-bold mt-1">{value}</div>
      {hint && <div className="text-xs text-muted-foreground mt-1">{hint}</div>}
    </Card>
  );
}

function AdminDashboard() {
  const fn = useServerFn(getSystemHealth);
  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ["admin-health"],
    queryFn: () => fn(),
    refetchInterval: 60000,
  });

  if (isLoading) return <div className="text-sm text-muted-foreground">Carregando saúde do sistema…</div>;
  if (error) return (
    <Card className="p-6">
      <div className="flex items-center gap-2 text-red-500"><XCircle size={18} /> <span className="font-medium">Erro</span></div>
      <div className="text-sm text-muted-foreground mt-1">{(error as Error).message}</div>
      <div className="text-xs text-muted-foreground mt-2">Apenas owner/admin podem acessar este painel.</div>
    </Card>
  );
  if (!data) return null;

  const s = data.summary;
  const criticalIssues = s.failed_runs_7d + s.sigma_errors_7d + s.meta_errors_7d + s.gads_errors_7d;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="text-xs text-muted-foreground">
          Atualizado {new Date(data.generated_at).toLocaleTimeString("pt-BR")}
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw size={14} className={`mr-2 ${isFetching ? "animate-spin" : ""}`} /> Atualizar
        </Button>
      </div>

      {/* Overview */}
      <div>
        <h2 className="text-sm font-semibold uppercase text-muted-foreground mb-2">Visão geral</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
          <Stat label="Leads" value={s.leads} hint={`+${s.leads_24h} em 24h`} />
          <Stat label="Tickets abertos" value={s.open_tickets} hint={`${s.tickets} no total`} />
          <Stat label="Inst. WhatsApp" value={s.wa_instances} />
          <Stat label="Contas Meta Ads" value={s.meta_accounts} />
          <Stat label="Contas Google Ads" value={s.google_accounts} />
          <Stat label="Integrações Sigma" value={s.sigma_integrations} />
          <Stat label="Automações" value={s.automations} hint={`${s.automation_runs_24h} execs 24h`} />
          <Stat label="Erros (7d)" value={criticalIssues} hint="Automação + Sigma + Ads" />
        </div>
      </div>

      {/* Integrações */}
      <div className="grid md:grid-cols-2 gap-4">
        <Card className="p-4">
          <h3 className="font-semibold mb-3 flex items-center gap-2">WhatsApp <Badge variant="secondary">{data.integrations.whatsapp.length}</Badge></h3>
          <div className="space-y-2">
            {data.integrations.whatsapp.length === 0 && <div className="text-xs text-muted-foreground">Nenhuma instância.</div>}
            {data.integrations.whatsapp.map((w: any) => (
              <div key={w.id} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2"><HealthDot h={w.health} /> <span className="font-medium">{w.name}</span> <span className="text-muted-foreground text-xs">{w.phone_number ?? ""}</span></div>
                <Badge variant="outline" className="text-xs">{w.status}</Badge>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-4">
          <h3 className="font-semibold mb-3 flex items-center gap-2">Sigma <Badge variant="secondary">{data.integrations.sigma.length}</Badge></h3>
          <div className="space-y-2">
            {data.integrations.sigma.length === 0 && <div className="text-xs text-muted-foreground">Nenhuma integração.</div>}
            {data.integrations.sigma.map((i: any) => (
              <div key={i.id} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2"><HealthDot h={i.health} /> <span className="font-medium">{i.name}</span></div>
                <Badge variant="outline" className="text-xs">{i.status}</Badge>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-4">
          <h3 className="font-semibold mb-3 flex items-center gap-2">Meta Ads <Badge variant="secondary">{data.integrations.meta.length}</Badge></h3>
          <div className="space-y-2">
            {data.integrations.meta.length === 0 && <div className="text-xs text-muted-foreground">Nenhuma conta conectada.</div>}
            {data.integrations.meta.map((m: any) => (
              <div key={m.id} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2"><HealthDot h={m.health} /> <span className="font-medium">{m.name}</span></div>
                <div className="flex items-center gap-2">
                  <HealthDot h={m.token_health} />
                  <span className="text-xs text-muted-foreground">token</span>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-4">
          <h3 className="font-semibold mb-3 flex items-center gap-2">Google Ads <Badge variant="secondary">{data.integrations.google.length}</Badge></h3>
          <div className="space-y-2">
            {data.integrations.google.length === 0 && <div className="text-xs text-muted-foreground">Nenhuma conta conectada.</div>}
            {data.integrations.google.map((g: any) => (
              <div key={g.id} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2"><HealthDot h={g.health} /> <span className="font-medium">{g.name}</span></div>
                <div className="flex items-center gap-2">
                  <HealthDot h={g.token_health} />
                  <span className="text-xs text-muted-foreground">token</span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Erros */}
      <div className="grid md:grid-cols-2 gap-4">
        <Card className="p-4">
          <h3 className="font-semibold mb-3">Automações com erro (7d)</h3>
          <ErrorList items={data.errors.automations} render={(e: any) => `${e.error ?? "erro desconhecido"}`} />
        </Card>
        <Card className="p-4">
          <h3 className="font-semibold mb-3">Sigma – falhas (7d)</h3>
          <ErrorList items={data.errors.sigma} render={(e: any) => `${e.endpoint} → ${e.response_status ?? "?"} ${e.error ?? ""}`} />
        </Card>
        <Card className="p-4">
          <h3 className="font-semibold mb-3">Meta CAPI – erros (7d)</h3>
          <ErrorList items={data.errors.meta} render={(e: any) => `${e.event_name}: ${e.error ?? ""}`} />
        </Card>
        <Card className="p-4">
          <h3 className="font-semibold mb-3">Google Ads conv. – erros (7d)</h3>
          <ErrorList items={data.errors.google} render={(e: any) => `${e.conversion_action}: ${e.error ?? ""}`} />
        </Card>
      </div>
    </div>
  );
}

function ErrorList({ items, render }: { items: any[]; render: (e: any) => string }) {
  if (!items?.length) return <div className="text-xs text-muted-foreground">Sem erros no período. 🎉</div>;
  return (
    <ul className="space-y-2 max-h-64 overflow-auto">
      {items.map((e) => (
        <li key={e.id} className="text-xs border-l-2 border-red-500/50 pl-2">
          <div className="text-muted-foreground">{new Date(e.created_at).toLocaleString("pt-BR")}</div>
          <div className="truncate">{render(e)}</div>
        </li>
      ))}
    </ul>
  );
}
