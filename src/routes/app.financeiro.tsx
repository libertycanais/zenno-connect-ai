import { createFileRoute, Link, Outlet, useLocation } from "@tanstack/react-router";

export const Route = createFileRoute("/app/financeiro")({
  component: FinanceLayout,
});

function FinanceLayout() {
  const loc = useLocation();
  const tabs = [
    { to: "/app/financeiro", label: "Resumo", exact: true },
    { to: "/app/financeiro/transacoes", label: "Transações" },
    { to: "/app/financeiro/categorias", label: "Categorias" },
  ];
  return (
    <div className="flex flex-col h-screen">
      <header className="px-6 py-4 border-b border-border">
        <h1 className="text-2xl font-bold">Financeiro</h1>
        <p className="text-sm text-muted-foreground">
          Controle entradas, saídas e fluxo de caixa da organização.
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
