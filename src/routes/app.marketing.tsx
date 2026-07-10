import { createFileRoute, Link, Outlet, useLocation } from "@tanstack/react-router";

export const Route = createFileRoute("/app/marketing")({ component: MarketingLayout });

const PROVIDERS = [
  { slug: "google", label: "Google", to: "/app/marketing/google", enabled: true },
  { slug: "meta", label: "Meta", to: "/app/marketing/meta", enabled: false },
  { slug: "tiktok", label: "TikTok", to: "/app/marketing/tiktok", enabled: false },
  { slug: "linkedin", label: "LinkedIn", to: "/app/marketing/linkedin", enabled: false },
  { slug: "microsoft", label: "Microsoft Ads", to: "/app/marketing/microsoft", enabled: false },
] as const;

function MarketingLayout() {
  const loc = useLocation();
  const primary = [
    { to: "/app/marketing", label: "Visão Geral", exact: true },
    { to: "/app/marketing/connect", label: "Conectar" },
  ];
  return (
    <div className="flex flex-col h-full">
      <header className="px-6 py-5 border-b border-border/60">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Marketing Center</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Plataforma unificada para Google, Meta, TikTok, LinkedIn e Microsoft Ads.
            </p>
          </div>
          <Link
            to="/app/marketing/connect"
            className="inline-flex items-center gap-2 rounded-md bg-primary text-primary-foreground px-3 py-1.5 text-sm hover:bg-primary/90"
          >
            + Nova conexão
          </Link>
        </div>

        <nav className="flex flex-wrap gap-1 mt-4">
          {primary.map((t) => {
            const active = t.exact ? loc.pathname === t.to : loc.pathname.startsWith(t.to);
            return (
              <Link key={t.to} to={t.to} className={`px-3 py-1.5 text-sm rounded-md transition-colors ${active ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}>
                {t.label}
              </Link>
            );
          })}
          <div className="mx-2 h-6 w-px bg-border self-center" />
          {PROVIDERS.map((p) => {
            const active = loc.pathname.startsWith(p.to);
            return (
              <Link
                key={p.slug}
                to={p.to}
                className={`px-3 py-1.5 text-sm rounded-md transition-colors flex items-center gap-1.5 ${active ? "bg-primary text-primary-foreground" : "hover:bg-muted text-muted-foreground"}`}
              >
                <span className={`inline-block h-1.5 w-1.5 rounded-full ${p.enabled ? "bg-emerald-500" : "bg-muted-foreground/40"}`} />
                {p.label}
                {!p.enabled && <span className="text-[10px] uppercase tracking-wide text-muted-foreground/70 ml-1">Em breve</span>}
              </Link>
            );
          })}
        </nav>
      </header>
      <div className="flex-1 min-h-0 overflow-auto p-6">
        <Outlet />
      </div>
    </div>
  );
}
