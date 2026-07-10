import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import {
  listMarketingProviders,
  listMarketingConnections,
  listMarketingAssets,
  startMarketingConnect,
  discoverConnectionAssets,
  bindMarketingAsset,
  refreshMarketingContext,
} from "@/lib/marketing.functions";

const searchSchema = z.object({
  provider: z.enum(["google", "meta", "tiktok", "linkedin", "microsoft"]).optional(),
  connectionId: z.string().uuid().optional(),
  status: z.string().optional(),
  error: z.string().optional(),
});

export const Route = createFileRoute("/app/marketing/connect")({
  component: ConnectWizard,
  validateSearch: (s) => searchSchema.parse(s),
});

type Step = "select" | "authorize" | "discovering" | "review" | "bind" | "done";

const PROGRESS_STEPS = [
  { label: "Autenticando com Google", duration: 800 },
  { label: "Lendo Google Ads", duration: 1400 },
  { label: "Lendo Analytics (GA4)", duration: 1200 },
  { label: "Lendo Tag Manager", duration: 900 },
  { label: "Lendo Search Console", duration: 900 },
  { label: "Consolidando ativos", duration: 700 },
];

function ConnectWizard() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const provsFn = useServerFn(listMarketingProviders);
  const connsFn = useServerFn(listMarketingConnections);
  const assetsFn = useServerFn(listMarketingAssets);
  const startFn = useServerFn(startMarketingConnect);
  const discoverFn = useServerFn(discoverConnectionAssets);
  const bindFn = useServerFn(bindMarketingAsset);
  const refreshCtxFn = useServerFn(refreshMarketingContext);

  const provs = useQuery({ queryKey: ["mkt-provs"], queryFn: () => provsFn() });
  const conns = useQuery({ queryKey: ["mkt-conns"], queryFn: () => connsFn() });
  const assets = useQuery({ queryKey: ["mkt-assets"], queryFn: () => assetsFn(), enabled: !!search.connectionId });

  const [step, setStep] = useState<Step>(() => (search.connectionId ? "discovering" : "select"));
  const [progressIdx, setProgressIdx] = useState(0);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [selectedProvider, setSelectedProvider] = useState<string>(search.provider ?? "google");

  const activeConnection = useMemo(
    () => (conns.data?.connections ?? []).find((c) => c.id === search.connectionId),
    [conns.data, search.connectionId],
  );

  const connectionAssets = useMemo(
    () => (assets.data?.assets ?? []).filter((a) => a.connection_id === search.connectionId),
    [assets.data, search.connectionId],
  );

  // Trigger discovery when arriving with connectionId
  const discovery = useMutation({
    mutationFn: async (connectionId: string) => discoverFn({ data: { connectionId } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["mkt-assets"] });
      qc.invalidateQueries({ queryKey: ["mkt-conns"] });
      setStep("review");
    },
    onError: () => setStep("review"),
  });

  useEffect(() => {
    if (search.connectionId && step === "discovering" && !discovery.isPending && !discovery.isSuccess) {
      discovery.mutate(search.connectionId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search.connectionId]);

  // Fake progress animation while discovery runs
  useEffect(() => {
    if (step !== "discovering") return;
    if (progressIdx >= PROGRESS_STEPS.length - 1) return;
    const t = setTimeout(() => setProgressIdx((i) => Math.min(PROGRESS_STEPS.length - 1, i + 1)), PROGRESS_STEPS[progressIdx].duration);
    return () => clearTimeout(t);
  }, [step, progressIdx]);

  // Auto-select MCC children when a manager is detected (per spec)
  useEffect(() => {
    if (step !== "review") return;
    const managers = connectionAssets.filter((a) => (a.capabilities as Record<string, unknown> | null)?.manager === true);
    if (managers.length > 0 && selected.size === 0) {
      const next = new Set<string>();
      for (const a of connectionAssets) {
        const caps = (a.capabilities as Record<string, unknown> | null) ?? {};
        if (caps.parent_mcc || a.asset_kind !== "google_ads_account") next.add(a.id);
      }
      setSelected(next);
    }
  }, [step, connectionAssets, selected.size]);

  const start = useMutation({
    mutationFn: async (provider: "google" | "meta" | "tiktok" | "linkedin" | "microsoft") =>
      startFn({ data: { provider, redirectAfter: "/app/marketing/connect" } }),
    onSuccess: (r) => { window.location.href = r.url; },
  });

  const bind = useMutation({
    mutationFn: async () => {
      for (const id of selected) {
        await bindFn({ data: { assetId: id, purpose: "primary" } });
      }
      await refreshCtxFn();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["mkt-conns"] });
      setStep("done");
    },
  });

  const filteredAssets = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return connectionAssets;
    return connectionAssets.filter((a) => {
      const caps = (a.capabilities as Record<string, unknown> | null) ?? {};
      return (
        a.name?.toLowerCase().includes(q) ||
        a.external_id?.toLowerCase().includes(q) ||
        a.asset_kind?.toLowerCase().includes(q) ||
        String(caps.status ?? "").toLowerCase().includes(q) ||
        String(caps.parent_mcc ?? "").toLowerCase().includes(q)
      );
    });
  }, [connectionAssets, query]);

  const grouped = useMemo(() => {
    const g: Record<string, typeof filteredAssets> = {};
    for (const a of filteredAssets) (g[a.asset_kind] ??= []).push(a);
    return g;
  }, [filteredAssets]);

  return (
    <div className="max-w-4xl">
      <Steps current={step} />

      {search.error && (
        <div className="mt-4 rounded-md border border-red-500/40 bg-red-500/10 text-red-500 text-sm px-4 py-3">
          Falha na conexão: {search.error}
        </div>
      )}

      {step === "select" && (
        <section className="mt-6 space-y-4">
          <h2 className="text-xl font-semibold">Escolha a plataforma</h2>
          <p className="text-sm text-muted-foreground">Você será redirecionado para autorizar a Zenno a ler seus ativos.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {(provs.data?.providers ?? []).map((p) => (
              <button
                key={p.provider}
                disabled={!p.enabled || start.isPending}
                onClick={() => { setSelectedProvider(p.provider); start.mutate(p.provider); }}
                className="text-left rounded-lg border border-border/60 bg-card p-4 hover:border-primary/60 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="font-medium">{p.label}</div>
                  <span className={`text-[11px] uppercase tracking-wider px-2 py-0.5 rounded-full ${p.enabled ? "text-emerald-500 bg-emerald-500/10" : "text-muted-foreground bg-muted"}`}>
                    {p.enabled ? "Disponível" : "Em breve"}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Escopos: {p.scopes.length} · Descoberta automática de ativos
                </p>
              </button>
            ))}
          </div>
          {start.isPending && <div className="text-sm text-muted-foreground">Redirecionando para {selectedProvider}...</div>}
          {start.error && <div className="text-sm text-red-500">{(start.error as Error).message}</div>}
        </section>
      )}

      {step === "discovering" && (
        <section className="mt-6 space-y-6">
          <div>
            <h2 className="text-xl font-semibold">Descobrindo seus ativos</h2>
            <p className="text-sm text-muted-foreground mt-1">Estamos lendo tudo o que sua conta tem acesso. Isso pode levar alguns segundos.</p>
          </div>
          <div className="space-y-2">
            {PROGRESS_STEPS.map((s, i) => {
              const done = i < progressIdx || (i === PROGRESS_STEPS.length - 1 && discovery.isSuccess);
              const current = i === progressIdx && !discovery.isSuccess;
              return (
                <div key={s.label} className="flex items-center gap-3 text-sm">
                  <span className={`h-2 w-2 rounded-full ${done ? "bg-emerald-500" : current ? "bg-primary animate-pulse" : "bg-muted"}`} />
                  <span className={done ? "text-foreground" : current ? "text-foreground" : "text-muted-foreground"}>{s.label}</span>
                  {done && <span className="text-emerald-500 text-xs">✓</span>}
                </div>
              );
            })}
          </div>
          <div className="h-1.5 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full bg-primary transition-all duration-500"
              style={{ width: `${discovery.isSuccess ? 100 : Math.round(((progressIdx + 1) / PROGRESS_STEPS.length) * 90)}%` }}
            />
          </div>
        </section>
      )}

      {step === "review" && (
        <section className="mt-6 space-y-5">
          <div>
            <h2 className="text-xl font-semibold">Encontramos {connectionAssets.length} ativos</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Conta: <span className="text-foreground">{activeConnection?.display_name ?? "—"}</span> · Selecione o que a IA deve monitorar.
            </p>
          </div>

          <input
            type="search"
            placeholder="Buscar por nome, ID, label ou status..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
          />

          <div className="space-y-4 max-h-[420px] overflow-auto pr-1">
            {Object.entries(grouped).length === 0 ? (
              <div className="text-sm text-muted-foreground p-6 text-center border border-dashed border-border/60 rounded-md">
                Nenhum ativo encontrado. {query && "Ajuste a busca."}
              </div>
            ) : Object.entries(grouped).map(([kind, list]) => (
              <div key={kind}>
                <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">{kind} ({list.length})</div>
                <div className="rounded-md border border-border/60 divide-y divide-border/40 bg-card">
                  {list.map((a) => {
                    const caps = (a.capabilities as Record<string, unknown> | null) ?? {};
                    const isManager = caps.manager === true;
                    const parentMcc = caps.parent_mcc as string | undefined;
                    const checked = selected.has(a.id);
                    return (
                      <label key={a.id} className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-muted/40">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => {
                            const next = new Set(selected);
                            if (e.target.checked) next.add(a.id); else next.delete(a.id);
                            setSelected(next);
                          }}
                          className="accent-primary"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium truncate flex items-center gap-2">
                            {a.name}
                            {isManager && <span className="text-[10px] uppercase text-primary bg-primary/10 px-1.5 py-0.5 rounded">MCC</span>}
                            {parentMcc && <span className="text-[10px] uppercase text-muted-foreground bg-muted px-1.5 py-0.5 rounded">sob {parentMcc}</span>}
                          </div>
                          <div className="text-xs text-muted-foreground truncate">
                            ID {a.external_id}{a.currency ? ` · ${a.currency}` : ""}{a.timezone ? ` · ${a.timezone}` : ""}
                          </div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          <div className="rounded-md border border-border/60 bg-card p-4 space-y-2">
            <div className="text-sm font-medium">Vincular à organização</div>
            <div className="text-xs text-muted-foreground">
              Esta conta será vinculada à sua organização atual. Você poderá revisar e mudar depois em Configurações.
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">{selected.size} ativo(s) selecionado(s)</div>
            <div className="flex gap-2">
              <button onClick={() => navigate({ to: "/app/marketing" })} className="px-4 py-2 text-sm rounded-md border border-border hover:bg-muted">Cancelar</button>
              <button
                disabled={selected.size === 0 || bind.isPending}
                onClick={() => bind.mutate()}
                className="px-4 py-2 text-sm rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {bind.isPending ? "Vinculando..." : "Confirmar e continuar"}
              </button>
            </div>
          </div>
        </section>
      )}

      {step === "done" && (
        <section className="mt-8 text-center space-y-4">
          <div className="mx-auto h-14 w-14 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center text-2xl">✓</div>
          <h2 className="text-xl font-semibold">Conexão concluída</h2>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            A IA já pode gerar análises com os dados de {activeConnection?.display_name ?? "sua conta"}.
          </p>
          <div className="flex gap-2 justify-center">
            <button onClick={() => navigate({ to: "/app/marketing" })} className="px-4 py-2 text-sm rounded-md bg-primary text-primary-foreground hover:bg-primary/90">
              Ir para o Marketing Center
            </button>
            <button onClick={() => { setStep("select"); setSelected(new Set()); navigate({ to: "/app/marketing/connect" }); }} className="px-4 py-2 text-sm rounded-md border border-border hover:bg-muted">
              Conectar outra plataforma
            </button>
          </div>
        </section>
      )}
    </div>
  );
}

function Steps({ current }: { current: Step }) {
  const items: { key: Step; label: string }[] = [
    { key: "select", label: "Plataforma" },
    { key: "discovering", label: "Descoberta" },
    { key: "review", label: "Seleção" },
    { key: "done", label: "Concluído" },
  ];
  const idx = items.findIndex((i) => i.key === current);
  return (
    <div className="flex items-center gap-3 text-xs">
      {items.map((it, i) => {
        const active = i <= idx;
        return (
          <div key={it.key} className="flex items-center gap-3">
            <div className={`flex items-center gap-2 ${active ? "text-foreground" : "text-muted-foreground"}`}>
              <span className={`h-6 w-6 rounded-full flex items-center justify-center text-[11px] font-medium ${active ? "bg-primary text-primary-foreground" : "bg-muted"}`}>{i + 1}</span>
              {it.label}
            </div>
            {i < items.length - 1 && <div className={`h-px w-8 ${i < idx ? "bg-primary" : "bg-border"}`} />}
          </div>
        );
      })}
    </div>
  );
}
