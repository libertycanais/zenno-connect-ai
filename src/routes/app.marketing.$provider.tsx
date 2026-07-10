import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listMarketingConnections, listMarketingProviders } from "@/lib/marketing.functions";

const PROVIDER_META: Record<string, { label: string; enabled: boolean; blurb: string }> = {
  google: { label: "Google", enabled: true, blurb: "Google Ads, GA4, Tag Manager, Search Console e Merchant Center." },
  meta: { label: "Meta", enabled: false, blurb: "Facebook Ads, Instagram, Pixel, Conversions API." },
  tiktok: { label: "TikTok", enabled: false, blurb: "TikTok Ads, Pixel e Events API." },
  linkedin: { label: "LinkedIn", enabled: false, blurb: "Campaign Manager e Insight Tag." },
  microsoft: { label: "Microsoft Ads", enabled: false, blurb: "Bing/Microsoft Advertising, UET." },
};

export const Route = createFileRoute("/app/marketing/$provider")({ component: ProviderPage });

function ProviderPage() {
  const { provider } = Route.useParams();
  const meta = PROVIDER_META[provider];
  const connsFn = useServerFn(listMarketingConnections);
  const provsFn = useServerFn(listMarketingProviders);
  const conns = useQuery({ queryKey: ["mkt-conns"], queryFn: () => connsFn() });
  useQuery({ queryKey: ["mkt-provs"], queryFn: () => provsFn() });

  if (!meta) {
    return <div className="text-sm text-muted-foreground">Plataforma desconhecida.</div>;
  }

  const providerConns = (conns.data?.connections ?? []).filter((c) => c.provider === provider);

  return (
    <div className="max-w-4xl space-y-6">
      <header>
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-semibold">{meta.label}</h2>
          <span className={`text-[11px] uppercase tracking-wider px-2 py-0.5 rounded-full ${meta.enabled ? "text-emerald-500 bg-emerald-500/10" : "text-muted-foreground bg-muted"}`}>
            {meta.enabled ? "Disponível" : "Em breve"}
          </span>
        </div>
        <p className="text-sm text-muted-foreground mt-1">{meta.blurb}</p>
      </header>

      {!meta.enabled ? (
        <div className="rounded-lg border border-dashed border-border/60 p-8 text-center bg-card/40">
          <div className="text-lg font-medium">Em breve</div>
          <p className="text-sm text-muted-foreground mt-2 max-w-md mx-auto">
            O conector de {meta.label} está em desenvolvimento. Enquanto isso, conecte o Google para ativar as análises da IA.
          </p>
          <Link to="/app/marketing/connect" className="inline-flex mt-4 px-3 py-1.5 text-sm rounded-md bg-primary text-primary-foreground hover:bg-primary/90">Conectar Google</Link>
        </div>
      ) : providerConns.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border/60 p-8 text-center bg-card/40">
          <div className="text-lg font-medium">Nenhuma conta {meta.label} conectada</div>
          <p className="text-sm text-muted-foreground mt-2 max-w-md mx-auto">
            Autorize a Zenno a ler seus ativos para começar a monitoramento e análises automáticas.
          </p>
          <Link to="/app/marketing/connect" search={{ provider }} className="inline-flex mt-4 px-3 py-1.5 text-sm rounded-md bg-primary text-primary-foreground hover:bg-primary/90">
            Conectar {meta.label} →
          </Link>
        </div>
      ) : (
        <div className="space-y-2">
          {providerConns.map((c) => (
            <div key={c.id} className="rounded-lg border border-border/60 bg-card p-4 flex items-center justify-between">
              <div>
                <div className="font-medium">{c.display_name}</div>
                <div className="text-xs text-muted-foreground mt-0.5">Health {c.last_health_score ?? "—"}% · {c.scopes?.length ?? 0} escopos</div>
              </div>
              <Link to="/app/marketing/connect" search={{ connectionId: c.id, provider: c.provider }} className="text-sm text-primary hover:underline">Gerenciar</Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
