import { createFileRoute, Link, Outlet, useLocation } from "@tanstack/react-router";

export const Route = createFileRoute("/app/sigma")({
  component: SigmaLayout,
});

function SigmaLayout() {
  const loc = useLocation();
  const tabs = [
    { to: "/app/sigma", label: "Integrações", exact: true },
    { to: "/app/sigma/console", label: "Console" },
    { to: "/app/sigma/logs", label: "Logs" },
  ];
  return (
    <div className="flex flex-col h-screen">
      <header className="px-6 py-4 border-b border-border">
        <h1 className="text-2xl font-bold">Sigma</h1>
        <p className="text-sm text-muted-foreground">
          Hub de integrações com APIs externas. Cadastre endpoints, execute chamadas e acompanhe logs.
        </p>
        <nav className="flex gap-1 mt-3">
          {tabs.map((t) => {
            const active = t.exact ? loc.pathname === t.to : loc.pathname.startsWith(t.to);
            return (
              <Link
                key={t.to}
                to={t.to}
                className={`px-3 py-1.5 text-sm rounded-md ${active ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
              >
                {t.label}
              </Link>
            );
          })}
        </nav>
      </header>
      <div className="flex-1 min-h-0 overflow-auto p-6"><Outlet /></div>
    </div>
  );
}
