// EPIC K.2 — WorkspaceSidebar (nav das seções do Zenno OS)
import { Link, useLocation } from "@tanstack/react-router";
import {
  LayoutDashboard, FileBarChart, Lightbulb, Sparkles, Brain, PlayCircle, Layers,
} from "lucide-react";

type NavItem = { to: string; label: string; icon: typeof Layers; exact?: boolean };

const items: readonly NavItem[] = [
  { to: "/app/workspace", label: "Visão Geral", icon: Layers, exact: true },
  { to: "/app/workspace/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/app/workspace/reports", label: "Relatórios", icon: FileBarChart },
  { to: "/app/workspace/recommendations", label: "Recomendações", icon: Lightbulb },
  { to: "/app/workspace/insights", label: "Insights", icon: Sparkles },
  { to: "/app/workspace/memory", label: "Memória", icon: Brain },
  { to: "/app/workspace/actions", label: "Action Center", icon: PlayCircle },
];

export function WorkspaceSidebar() {
  const loc = useLocation();
  return (
    <aside className="hidden md:flex w-56 shrink-0 flex-col border-r border-border/60 bg-sidebar/30 p-3 gap-1">
      <div className="px-2 py-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
        Zenno OS
      </div>
      {items.map((it) => {
        const active = it.exact
          ? loc.pathname === it.to
          : loc.pathname === it.to || loc.pathname.startsWith(`${it.to}/`);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const to = it.to as any;
        return (
          <Link
            key={it.to}
            to={to}
            className={
              "flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors " +
              (active
                ? "bg-primary/15 text-primary font-medium"
                : "text-muted-foreground hover:bg-muted hover:text-foreground")
            }
          >
            <it.icon size={16} />
            <span className="truncate">{it.label}</span>
          </Link>
        );
      })}
    </aside>
  );
}
