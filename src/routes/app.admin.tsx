import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/app/admin")({
  component: () => (
    <div className="flex flex-col h-screen">
      <header className="px-6 py-4 border-b border-border">
        <h1 className="text-2xl font-bold">Painel Admin</h1>
        <p className="text-sm text-muted-foreground">Saúde do sistema, integrações e erros recentes.</p>
      </header>
      <div className="flex-1 min-h-0 overflow-auto p-6"><Outlet /></div>
    </div>
  ),
});
