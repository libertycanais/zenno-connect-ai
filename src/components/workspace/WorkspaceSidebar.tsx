// EPIC K.2 — WorkspaceSidebar (Enterprise Design System v2)
// Command-center style grouped navigation.
import { Link, useLocation } from "@tanstack/react-router";
import {
  LayoutDashboard, FileBarChart, Lightbulb, Sparkles, Brain, PlayCircle, Layers,
  Users, KanbanSquare, MessageSquare, UserPlus, Megaphone, Search, Target, TrendingUp,
  DollarSign, CreditCard, Building2, Settings, Bot, Activity, ShieldCheck,
} from "lucide-react";
import logo from "@/assets/zenno-logo.png";

type Item = { to: string; label: string; icon: typeof Layers; exact?: boolean };
type Group = { label: string; icon: string; items: readonly Item[] };

const groups: readonly Group[] = [
  {
    label: "Command Center", icon: "🏠",
    items: [
      { to: "/app/workspace", label: "Command Center", icon: Layers, exact: true },
      { to: "/app/workspace/dashboard", label: "Executive Overview", icon: LayoutDashboard },
      { to: "/app/executivo", label: "Executive Center", icon: TrendingUp },
      { to: "/app/ia/copiloto", label: "AI Command", icon: Sparkles },
      { to: "/app/workspace/actions", label: "Mission Control", icon: PlayCircle },
    ],
  },
  {
    label: "Operação", icon: "👥",
    items: [
      { to: "/app/clientes", label: "Clientes", icon: Users },
      { to: "/app/leads", label: "Leads", icon: UserPlus },
      { to: "/app/leads/kanban", label: "Pipeline", icon: KanbanSquare },
      { to: "/app/whatsapp", label: "WhatsApp", icon: MessageSquare },
      { to: "/app/tickets", label: "Tickets", icon: Activity },
    ],
  },
  {
    label: "Marketing", icon: "📈",
    items: [
      { to: "/app/google-ads", label: "Google Ads", icon: Search },
      { to: "/app/meta-ads", label: "Meta Ads", icon: Megaphone },
      { to: "/app/meta-ads/criativos", label: "ROI Criativos", icon: TrendingUp },
      { to: "/app/leads/atribuicao", label: "Attribution", icon: Target },
    ],
  },
  {
    label: "AI Intelligence", icon: "🧠",
    items: [
      { to: "/app/inteligencia", label: "Analytics", icon: Sparkles },
      { to: "/app/workspace/insights", label: "Insights", icon: Lightbulb },
      { to: "/app/inteligencia/evidencias", label: "Evidence", icon: FileBarChart },
      { to: "/app/inteligencia/recomendacoes", label: "Recommendations", icon: Brain },
      { to: "/app/inteligencia/playbooks", label: "Playbooks", icon: PlayCircle },
      { to: "/app/ia", label: "Experts", icon: Bot },
    ],
  },
  {
    label: "Negócio", icon: "💰",
    items: [
      { to: "/app/financeiro", label: "Financeiro", icon: DollarSign },
      { to: "/app/leads/cobrancas", label: "Cobranças", icon: CreditCard },
      { to: "/app/workspace/reports", label: "Relatórios", icon: FileBarChart },
    ],
  },
  {
    label: "Sistema", icon: "⚙",
    items: [
      { to: "/app/organizacao", label: "Organização", icon: Building2 },
      { to: "/app/workspace/memory", label: "Memória", icon: Brain },
      { to: "/app/admin", label: "Admin", icon: ShieldCheck },
      { to: "/app/settings", label: "Configurações", icon: Settings },
    ],
  },
];

export function WorkspaceSidebar() {
  const loc = useLocation();
  return (
    <aside className="hidden md:flex w-64 shrink-0 flex-col border-r border-sidebar-border/60 bg-sidebar/70 backdrop-blur-xl relative z-10">
      <div className="px-5 pt-5 pb-3 flex items-center gap-2">
        <img src={logo} alt="Zenno" className="h-9 w-auto drop-shadow-[0_0_16px_oklch(0.72_0.18_235/0.45)]" />
        <div className="flex flex-col leading-tight">
          <span className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Zenno OS</span>
          <span className="text-[10px] text-primary/80">Enterprise · v2</span>
        </div>
      </div>

      <div className="mx-4 mb-3 rounded-lg border border-primary/15 bg-primary/5 px-3 py-2 flex items-center gap-2">
        <span className="h-2 w-2 rounded-full bg-emerald-400 zenno-pulse-dot" />
        <span className="text-[11px] text-muted-foreground">AI Runtime</span>
        <span className="ml-auto text-[10px] text-emerald-400">online</span>
      </div>

      <nav className="flex-1 overflow-y-auto px-2 pb-4 space-y-4">
        {groups.map((g) => (
          <div key={g.label}>
            <div className="px-3 py-1.5 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/80">
              <span className="text-sm leading-none">{g.icon}</span>
              <span>{g.label}</span>
            </div>
            <ul className="space-y-0.5">
              {g.items.map((it) => {
                const active = it.exact
                  ? loc.pathname === it.to
                  : loc.pathname === it.to || loc.pathname.startsWith(`${it.to}/`);
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const to = it.to as any;
                return (
                  <li key={it.to}>
                    <Link
                      to={to}
                      className={
                        "group relative flex items-center gap-2.5 rounded-md px-3 py-1.5 text-[13px] transition-all duration-150 " +
                        (active
                          ? "bg-gradient-to-r from-primary/20 via-primary/10 to-transparent text-foreground font-medium shadow-[inset_2px_0_0_0_var(--primary)]"
                          : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground")
                      }
                    >
                      <it.icon size={14} className={active ? "text-primary" : "text-muted-foreground/80 group-hover:text-foreground"} />
                      <span className="truncate">{it.label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="border-t border-sidebar-border/60 px-4 py-3 text-[10px] text-muted-foreground/70 flex items-center justify-between">
        <span>Freeze v1.0</span>
        <span className="text-primary/80">RC2 Pilot</span>
      </div>
    </aside>
  );
}
