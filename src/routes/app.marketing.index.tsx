import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import {
  listMarketingConnections,
  listMarketingProviders,
  getMarketingHealthOverview,
  getMarketingTimeline,
  disconnectMarketingConnection,
} from "@/lib/marketing.functions";

export const Route = createFileRoute("/app/marketing/")({ component: MarketingIndex });

function timeAgo(iso?: string | null) {
  if (!iso) return "—";
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return `${s}s atrás`;
  if (s < 3600) return `${Math.floor(s / 60)} min atrás`;
  if (s < 86400) return `${Math.floor(s / 3600)} h atrás`;
  return `${Math.floor(s / 86400)} d atrás`;
}

function healthColor(status: string | null | undefined) {
  if (status === "online") return "text-emerald-500 bg-emerald-500/10";
  if (status === "warning") return "text-amber-500 bg-amber-500/10";
  if (status === "offline") return "text-red-500 bg-red-500/10";
  return "text-muted-foreground bg-muted";
}

function MarketingIndex() {
  const qc = useQueryClient();
  const connsFn = useServerFn(listMarketingConnections);
  const provsFn = useServerFn(listMarketingProviders);
  const healthFn = useServerFn(getMarketingHealthOverview);
  const timelineFn = useServerFn(getMarketingTimeline);
  const disconnectFn = useServerFn(disconnectMarketingConnection);

  const conns = useQuery({ queryKey: ["mkt-conns"], queryFn: () => connsFn() });
  const provs = useQuery({ queryKey: ["mkt-provs"], queryFn: () => provsFn() });
  const health = useQuery({ queryKey: ["mkt-health"], queryFn: () => healthFn() });
  const timeline = useQuery({ queryKey: ["mkt-timeline"], queryFn: () => timelineFn({ data: { limit: 20 } }) });

  const [busyId, setBusyId] = useState<string | null>(null);
  const disconnect = useMutation({
    mutationFn: async (id: string) => {
      setBusyId(id);
      try { return await disconnectFn({ data: { id } }); } finally { setBusyId(null); }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["mkt-conns"] }),
  });

  const providers = provs.data?.providers ?? [];
  const connections = conns.data?.connections ?? [];
  const overview = health.data?.overview ?? [];

  const overviewByProvider = useMemo(() => {
    const m = new Map<string, { avgScore: number; online: number; warning: number; offline: number; count: number }>();
    for (const o of overview) m.set(o.provider, o);
    return m;
  }, [overview]);

  const isEmpty = !conns.isLoading && connections.length === 0;

  return (
    <div className="space-y-8 max-w-6xl">
      {/* Provider grid — always visible so the user sees the roadmap */}
      <section>
        <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-3">Plataformas</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {providers.map((p) => {
            const provConns = connections.filter((c) => c.provider === p.provider);
            const isConnected = provConns.length > 0;
            const ov = overviewByProvider.get(p.provider);
            return (
              <div key={p.provider} className="rounded-lg border border-border/60 bg-card p-4 flex flex-col gap-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-medium">{p.label}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {p.enabled ? (isConnected ? `${provConns.length} conexão(ões)` : "Disponível") : "Em breve"}
                    </div>
                  </div>
                  <span className={`inline-flex items-center gap-1.5 text-[11px] uppercase tracking-wider px-2 py-0.5 rounded-full ${isConnected ? "text-emerald-500 bg-emerald-500/10" : p.enabled ? "text-muted-foreground bg-muted" : "text-muted-foreground/60 bg-muted/50"}`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${isConnected ? "bg-emerald-500" : p.enabled ? "bg-muted-foreground/40" : "bg-muted-foreground/30"}`} />
                    {isConnected ? "Conectado" : p.enabled ? "Pronto" : "Em breve"}
                  </span>
                </div>
                {isConnected && ov && (
                  <div className="text-xs text-muted-foreground grid grid-cols-3 gap-2 border-t border-border/40 pt-3">
                    <div><div className="text-[10px] uppercase tracking-wider">Health</div><div className="text-foreground font-medium">{ov.avgScore}%</div></div>
                    <div><div className="text-[10px] uppercase tracking-wider">Ativos</div><div className="text-foreground font-medium">{ov.count}</div></div>
                    <div><div className="text-[10px] uppercase tracking-wider">Alertas</div><div className="text-foreground font-medium">{ov.warning + ov.offline}</div></div>
                  </div>
                )}
                <div className="mt-auto">
                  {p.enabled ? (
                    <Link to="/app/marketing/connect" search={{ provider: p.provider }} className="text-sm text-primary hover:underline">
                      {isConnected ? "Adicionar outra conexão →" : "Conectar →"}
                    </Link>
                  ) : (
                    <span className="text-xs text-muted-foreground">Aguardando disponibilidade</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Connections */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Conexões ativas</h2>
          {!isEmpty && (
            <Link to="/app/marketing/connect" className="text-sm text-primary hover:underline">+ Adicionar</Link>
          )}
        </div>

        {isEmpty ? (
          <EmptyState />
        ) : (
          <div className="space-y-2">
            {connections.map((c) => (
              <div key={c.id} className="rounded-lg border border-border/60 bg-card p-4 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <span className={`h-2 w-2 rounded-full ${c.status === "active" ? "bg-emerald-500" : c.status === "error" ? "bg-red-500" : "bg-amber-500"}`} />
                  <div className="min-w-0">
                    <div className="font-medium truncate">{c.display_name ?? c.provider}</div>
                    <div className="text-xs text-muted-foreground truncate">
                      {c.provider} · {c.scopes?.length ?? 0} escopos · última sincronização {timeAgo(c.last_health_at ?? c.created_at)}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${healthColor(c.last_health_status)}`}>
                    Health {c.last_health_score ?? "—"}%
                  </span>
                  <Link
                    to="/app/marketing/connect"
                    search={{ connectionId: c.id, provider: c.provider }}
                    className="text-sm text-primary hover:underline"
                  >
                    Gerenciar
                  </Link>
                  <button
                    disabled={busyId === c.id}
                    onClick={() => disconnect.mutate(c.id)}
                    className="text-sm text-muted-foreground hover:text-red-500 disabled:opacity-50"
                  >
                    Revogar
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Timeline */}
      {!isEmpty && (
        <section>
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-3">Timeline recente</h2>
          <div className="rounded-lg border border-border/60 bg-card divide-y divide-border/40">
            {(timeline.data?.events ?? []).length === 0 ? (
              <div className="p-4 text-sm text-muted-foreground">Sem eventos ainda.</div>
            ) : (
              (timeline.data?.events ?? []).map((e) => (
                <div key={e.id} className="p-3 flex items-center justify-between text-sm">
                  <div className="flex items-center gap-3">
                    <span className={`h-1.5 w-1.5 rounded-full ${e.severity === "error" ? "bg-red-500" : e.severity === "warning" ? "bg-amber-500" : e.severity === "success" ? "bg-emerald-500" : "bg-muted-foreground/40"}`} />
                    <span className="font-medium">{e.event_type}</span>
                    <span className="text-muted-foreground text-xs">{e.provider ?? "—"}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">{timeAgo(e.occurred_at)}</span>
                </div>
              ))
            )}
          </div>
        </section>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-xl border border-dashed border-border/60 bg-card/40 p-10 text-center">
      <div className="mx-auto mb-5 h-14 w-14 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center text-primary text-2xl">
        ◎
      </div>
      <h3 className="text-lg font-medium">Nenhuma plataforma conectada</h3>
      <p className="text-sm text-muted-foreground mt-2 max-w-md mx-auto leading-relaxed">
        Conecte <span className="text-foreground">Google Ads</span>, <span className="text-foreground">GA4</span>,
        {" "}<span className="text-foreground">Tag Manager</span> e <span className="text-foreground">Search Console</span> para que a IA possa gerar análises, recomendações e alertas automaticamente.
      </p>
      <Link to="/app/marketing/connect" className="inline-flex items-center gap-2 mt-6 rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm hover:bg-primary/90">
        Conectar primeira plataforma →
      </Link>
    </div>
  );
}
