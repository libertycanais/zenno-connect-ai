// PX 1.3.1 — Premium Enterprise Navigation
// Aditivo. Sem alteração de lógica de auth, rotas ou contratos.
import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard, Users, KanbanSquare, MessageSquare, Megaphone, Search,
  DollarSign, Zap, Bot, Ticket, Settings, LogOut, ShieldCheck,
  Menu, X, Plug, CreditCard, Sparkles, Target, TrendingUp, Building2, Server,
  Home, UserPlus, Activity, Brain,
} from "lucide-react";
import { useEffect, useState, type ReactNode, type ComponentType } from "react";
import { ZennoMark } from "@/components/brand/ZennoMark";

type NavItem = {
  to: string;
  label: string;
  icon: ComponentType<{ size?: number; className?: string }>;
  exact?: boolean;
  ai?: boolean;
};
type NavGroup = { label: string; icon: ComponentType<{ size?: number; className?: string }>; items: readonly NavItem[] };

const groups: readonly NavGroup[] = [
  {
    label: "Command Center", icon: Home,
    items: [
      { to: "/app", label: "Dashboard", icon: LayoutDashboard, exact: true },
      { to: "/app/executivo", label: "Executive", icon: TrendingUp, ai: true },
      { to: "/app/workspace", label: "Workspace", icon: Sparkles, ai: true },
    ],
  },
  {
    label: "Sales", icon: Users,
    items: [
      { to: "/app/clientes", label: "Clientes", icon: Users },
      { to: "/app/leads", label: "Leads", icon: UserPlus },
      { to: "/app/leads/kanban", label: "Pipeline", icon: KanbanSquare },
      { to: "/app/leads/atribuicao", label: "Atribuição", icon: Target },
      { to: "/app/whatsapp", label: "WhatsApp", icon: MessageSquare },
      { to: "/app/tickets", label: "Tickets", icon: Ticket },
    ],
  },
  {
    label: "Marketing", icon: Megaphone,
    items: [
      { to: "/app/google-ads", label: "Google Ads", icon: Search },
      { to: "/app/meta-ads", label: "Meta Ads", icon: Megaphone },
      { to: "/app/meta-ads/criativos", label: "ROI Criativos", icon: TrendingUp },
      { to: "/app/sigma", label: "Sigma", icon: Server },
    ],
  },
  {
    label: "Finance", icon: DollarSign,
    items: [
      { to: "/app/financeiro", label: "Financeiro", icon: DollarSign },
      { to: "/app/leads/cobrancas", label: "Cobranças", icon: CreditCard },
      { to: "/app/assinatura", label: "Assinatura", icon: CreditCard },
    ],
  },
  {
    label: "Intelligence", icon: Brain,
    items: [
      { to: "/app/ia/copiloto", label: "Copilot", icon: Sparkles, ai: true },
      { to: "/app/inteligencia", label: "Inteligência", icon: Brain, ai: true },
      { to: "/app/ia", label: "Experts", icon: Bot, ai: true },
      { to: "/app/automacoes", label: "Automações", icon: Zap },
    ],
  },
  {
    label: "Workspace", icon: Settings,
    items: [
      { to: "/app/organizacao", label: "Organização", icon: Building2 },
      { to: "/app/integracoes", label: "Integrações", icon: Plug },
      { to: "/app/admin", label: "Admin", icon: ShieldCheck },
      { to: "/app/settings", label: "Configurações", icon: Settings },
    ],
  },
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
    <div className="min-h-dvh md:min-h-screen bg-background text-foreground relative">
      <button
        type="button"
        onClick={toggle}
        aria-label={open ? "Esconder menu" : "Mostrar menu"}
        className="fixed top-4 left-4 z-50 h-10 w-10 inline-flex items-center justify-center rounded-full bg-sidebar/90 backdrop-blur border border-sidebar-border shadow-lg shadow-primary/20 hover:bg-sidebar text-sidebar-foreground transition-colors zenno-focus-ring"
      >
        {open ? <X size={18} /> : <Menu size={18} />}
      </button>

      {open && (
        <div
          onClick={toggle}
          className="fixed inset-0 z-30 bg-black/50 backdrop-blur-sm md:hidden"
        />
      )}

      <aside
        className={
          "fixed top-4 bottom-4 left-4 z-40 w-64 flex flex-col rounded-2xl border border-sidebar-border/70 backdrop-blur-xl transition-all duration-300 ease-out " +
          "bg-[color-mix(in_oklab,var(--sidebar)_88%,transparent)] " +
          "shadow-[0_24px_60px_-24px_oklch(0_0_0/0.7),0_2px_8px_-2px_oklch(0.72_0.18_235/0.18)] " +
          (open ? "translate-x-0 opacity-100" : "-translate-x-[120%] opacity-0 pointer-events-none")
        }
      >
        {/* Ambient accent inside sidebar */}
        <div aria-hidden className="pointer-events-none absolute inset-0 rounded-2xl overflow-hidden">
          <div className="absolute -top-24 -left-16 h-56 w-56 rounded-full bg-primary/20 blur-3xl" />
          <div className="absolute -bottom-24 -right-16 h-56 w-56 rounded-full bg-accent/15 blur-3xl" />
        </div>

        {/* Brand */}
        <div className="relative px-5 pt-5 pb-4 flex items-center gap-3">
          <ZennoMark className="h-9 w-9" />
          <div className="flex flex-col leading-tight">
            <span className="text-[13px] font-semibold tracking-[0.24em] zenno-gradient-text">ZENNO</span>
            <span className="text-[9px] uppercase tracking-[0.26em] text-muted-foreground/80">Enterprise Intelligence OS</span>
          </div>
        </div>

        {/* AI Runtime pill */}
        <div className="relative mx-4 mb-3 rounded-lg border border-primary/20 bg-primary/[0.06] px-3 py-2 flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-emerald-400 zenno-pulse-dot" />
          <span className="text-[11px] text-muted-foreground">AI Runtime</span>
          <span className="ml-auto text-[10px] text-emerald-400">online</span>
        </div>

        <nav className="relative flex-1 overflow-y-auto px-3 pb-2 space-y-4">
          {groups.map((g, gi) => (
            <div key={g.label}>
              {gi > 0 && <div className="zenno-nav-divider mb-3" aria-hidden />}
              <div className="px-2 py-1.5 flex items-center gap-2 zenno-nav-group-title">
                <g.icon size={11} className="text-primary/70" />
                <span>{g.label}</span>
              </div>
              <ul className="space-y-0.5">
                {g.items.map((item) => {
                  const active = item.exact
                    ? loc.pathname === item.to
                    : loc.pathname === item.to || loc.pathname.startsWith(item.to + "/");
                  const Icon = item.icon;
                  return (
                    <li key={item.to}>
                      <Link
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        to={item.to as any}
                        data-active={active ? "true" : "false"}
                        className="zenno-nav-item zenno-focus-ring flex items-center gap-2.5 rounded-lg pl-4 pr-3 py-2 text-[13px] text-muted-foreground"
                      >
                        <Icon size={15} className="zenno-nav-icon text-muted-foreground/80" />
                        <span className="zenno-nav-label flex-1 truncate">{item.label}</span>
                        {item.ai && (
                          <span
                            className="zenno-ai-dot"
                            title="AI-powered"
                            aria-label="Módulo com IA ativa"
                          />
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        <div className="relative border-t border-sidebar-border/60 p-3">
          <div className="text-[11px] text-sidebar-foreground/70 truncate mb-2">{user?.email}</div>
          <Button variant="ghost" size="sm" className="w-full justify-start zenno-focus-ring" onClick={handleLogout}>
            <LogOut size={14} className="mr-2" /> Sair
          </Button>
          <div className="mt-2 flex items-center justify-between text-[10px] text-muted-foreground/70">
            <span>Freeze v1.0</span>
            <span className="text-primary/80">RC2 Pilot</span>
          </div>
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

// Legacy references kept for compatibility if imported elsewhere
export const _unused = { Activity };
