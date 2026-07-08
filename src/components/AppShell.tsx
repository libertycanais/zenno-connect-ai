import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard, Users, KanbanSquare, MessageSquare, Megaphone,
  Search, Server, DollarSign, Zap, Bot, Ticket, Settings, LogOut, ShieldCheck,
  Menu, X, Plug, CreditCard,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import logo from "@/assets/zenno-logo.png";

const nav = [
  { to: "/app", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { to: "/app/clientes", label: "Clientes", icon: Users },
  { to: "/app/leads", label: "Leads", icon: Users },
  { to: "/app/leads/kanban", label: "Pipeline", icon: KanbanSquare },
  { to: "/app/whatsapp", label: "WhatsApp", icon: MessageSquare },
  { to: "/app/meta-ads", label: "Meta Ads", icon: Megaphone },
  { to: "/app/google-ads", label: "Google Ads", icon: Search },
  { to: "/app/sigma", label: "Sigma", icon: Server },
  { to: "/app/financeiro", label: "Financeiro", icon: DollarSign },
  { to: "/app/integracoes", label: "Integrações", icon: Plug },
  { to: "/app/automacoes", label: "Automações", icon: Zap },
  { to: "/app/ia", label: "IA", icon: Bot },
  { to: "/app/ia/copiloto", label: "Copiloto Tráfego", icon: Sparkles },
  { to: "/app/tickets", label: "Tickets", icon: Ticket },
  { to: "/app/assinatura", label: "Assinatura", icon: CreditCard },
  { to: "/app/admin", label: "Admin", icon: ShieldCheck },
  { to: "/app/settings", label: "Configurações", icon: Settings },
];

const STORAGE_KEY = "zenno.sidebar.open";

export function AppShell({ children }: { children: ReactNode }) {
  const { user, signOut } = useAuth();
  const loc = useLocation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const v = localStorage.getItem(STORAGE_KEY);
    setOpen(v === null ? true : v === "1");
  }, []);

  function toggle() {
    setOpen((o) => {
      const next = !o;
      localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
      return next;
    });
  }

  async function handleLogout() {
    await signOut();
    navigate({ to: "/login" });
  }

  return (
    <div className="min-h-screen bg-background text-foreground relative">
      {/* Floating toggle button — always visible */}
      <button
        type="button"
        onClick={toggle}
        aria-label={open ? "Esconder menu" : "Mostrar menu"}
        className="fixed top-4 left-4 z-50 h-10 w-10 inline-flex items-center justify-center rounded-full bg-sidebar/90 backdrop-blur border border-sidebar-border shadow-lg shadow-primary/20 hover:bg-sidebar text-sidebar-foreground transition-colors"
      >
        {open ? <X size={18} /> : <Menu size={18} />}
      </button>

      {/* Backdrop on mobile when open */}
      {open && (
        <div
          onClick={toggle}
          className="fixed inset-0 z-30 bg-black/50 backdrop-blur-sm md:hidden"
        />
      )}

      {/* Floating sidebar */}
      <aside
        className={`fixed top-4 bottom-4 left-4 z-40 w-64 flex flex-col rounded-2xl bg-sidebar/95 backdrop-blur-xl border border-sidebar-border shadow-2xl shadow-primary/10 transition-all duration-300 ease-out ${
          open ? "translate-x-0 opacity-100" : "-translate-x-[120%] opacity-0 pointer-events-none"
        }`}
      >
        <div className="px-4 pt-5 pb-3 flex items-center justify-center">
          <img src={logo} alt="ZENNO CRM AI" className="h-16 w-auto object-contain drop-shadow-[0_0_12px_oklch(0.7_0.18_230/0.4)]" />
        </div>
        <nav className="flex-1 overflow-y-auto px-2 pb-2 space-y-0.5">
          {nav.map((item) => {
            const active = item.exact ? loc.pathname === item.to : loc.pathname.startsWith(item.to);
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors ${
                  active
                    ? "bg-gradient-to-r from-primary/25 to-accent/15 text-sidebar-accent-foreground border border-primary/30"
                    : "text-sidebar-foreground/80 hover:bg-sidebar-accent/40"
                }`}
              >
                <Icon size={16} /> <span className="flex-1">{item.label}</span>
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

      <main
        className={`min-w-0 transition-[padding] duration-300 ease-out ${
          open ? "md:pl-72" : "pl-0"
        }`}
      >
        <div className="pt-16 md:pt-4">{children}</div>
      </main>
    </div>
  );
}
