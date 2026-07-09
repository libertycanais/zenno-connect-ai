import { createFileRoute, Link, Outlet, useLocation } from "@tanstack/react-router";

export const Route = createFileRoute("/app/inteligencia")({ component: IntelligenceLayout });

const TABS = [
  { to: "/app/inteligencia", label: "Visão Geral", exact: true },
  { to: "/app/inteligencia/recomendacoes", label: "Recomendações" },
  { to: "/app/inteligencia/playbooks", label: "Playbooks" },
  { to: "/app/inteligencia/evidencias", label: "Evidências" },
];

function IntelligenceLayout() {
  const loc = useLocation();
  return (
    <div className="flex flex-col h-full">
      <header className="px-6 py-4 border-b border-border">
        <h1 className="text-2xl font-bold">Inteligência</h1>
        <p className="text-sm text-muted-foreground">
          Recomendações, playbooks e evidências geradas pelos Experts do Zenno.
        </p>
        <nav className="flex gap-1 mt-3 flex-wrap">
          {TABS.map((t) => {
            const active = t.exact ? loc.pathname === t.to : loc.pathname.startsWith(t.to);
            return (
              <Link
                key={t.to} to={t.to}
                className={`px-3 py-1.5 text-sm rounded-md ${active ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
              >{t.label}</Link>
            );
          })}
        </nav>
      </header>
      <div className="flex-1 min-h-0 overflow-auto"><Outlet /></div>
    </div>
  );
}
