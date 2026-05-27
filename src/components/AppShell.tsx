import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard, Users, KanbanSquare, MessageSquare, Megaphone,
  Search, Server, DollarSign, Zap, Bot, Ticket, Settings, LogOut, Sparkles,
} from "lucide-react";
import { type ReactNode } from "react";

const nav = [
  { to: "/app", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { to: "/app/leads", label: "Leads", icon: Users },
  { to: "/app/leads/kanban", label: "Pipeline", icon: KanbanSquare },
  { to: "/app/whatsapp", label: "WhatsApp", icon: MessageSquare },
  { to: "/app/meta-ads", label: "Meta Ads", icon: Megaphone, soon: true },
  { to: "/app/google-ads", label: "Google Ads", icon: Search, soon: true },
  { to: "/app/sigma", label: "Sigma", icon: Server, soon: true },
  { to: "/app/financeiro", label: "Financeiro", icon: DollarSign, soon: true },
  { to: "/app/automacoes", label: "Automações", icon: Zap, soon: true },
  { to: "/app/ia", label: "IA", icon: Bot, soon: true },
  { to: "/app/tickets", label: "Tickets", icon: Ticket, soon: true },
  { to: "/app/settings", label: "Configurações", icon: Settings },
];

export function AppShell({ children }: { children: ReactNode }) {
  const { user, signOut } = useAuth();
  const loc = useLocation();
  const navigate = useNavigate();

  async function handleLogout() {
    await signOut();
    navigate({ to: "/login" });
  }

  return (
    <div className="min-h-screen flex bg-background text-foreground">
      <aside className="w-64 shrink-0 bg-sidebar border-r border-sidebar-border hidden md:flex flex-col">
        <div className="px-5 py-5 flex items-center gap-2 font-bold text-lg">
          <Sparkles className="text-primary" size={20} /> ZENNO
        </div>
        <nav className="flex-1 overflow-y-auto px-2 space-y-0.5">
          {nav.map((item) => {
            const active = item.exact ? loc.pathname === item.to : loc.pathname.startsWith(item.to);
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors ${
                  active ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground/80 hover:bg-sidebar-accent/50"
                }`}
              >
                <Icon size={16} /> <span className="flex-1">{item.label}</span>
                {item.soon && <span className="text-[10px] uppercase opacity-60">soon</span>}
              </Link>
            );
          })}
        </nav>
        <div className="p-3 border-t border-sidebar-border">
          <div className="text-xs text-sidebar-foreground/70 truncate mb-2">{user?.email}</div>
          <Button variant="ghost" size="sm" className="w-full justify-start" onClick={handleLogout}>
            <LogOut size={14} className="mr-2" /> Sair
          </Button>
        </div>
      </aside>
      <main className="flex-1 min-w-0 overflow-x-auto">{children}</main>
    </div>
  );
}
