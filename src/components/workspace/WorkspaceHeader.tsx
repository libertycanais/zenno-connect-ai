// EPIC K.2 — WorkspaceHeader (Enterprise Design System v2)
import { Bell, Command, Sparkles, Search, Activity } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";

type Props = {
  title?: string;
  onOpenPalette: () => void;
  onOpenCopilot: () => void;
  onOpenNotifications: () => void;
};

export function WorkspaceHeader({ title, onOpenPalette, onOpenCopilot, onOpenNotifications }: Props) {
  const { user } = useAuth();
  const initial = (user?.email ?? "?").slice(0, 1).toUpperCase();
  return (
    <header className="sticky top-0 z-20 h-16 border-b border-border/50 bg-background/60 backdrop-blur-xl">
      <div className="h-full flex items-center gap-4 px-5">
        <div className="min-w-0 flex flex-col leading-tight">
          <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Workspace</span>
          <span className="text-sm font-semibold text-foreground truncate">{title ?? "Zenno OS"}</span>
        </div>

        <div className="hidden lg:flex items-center gap-2 pl-4 ml-2 border-l border-border/50">
          <div className="flex items-center gap-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/25 px-2.5 py-1">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 zenno-pulse-dot" />
            <span className="text-[11px] font-medium text-emerald-300">Health 98</span>
          </div>
          <div className="flex items-center gap-1.5 rounded-full bg-primary/10 border border-primary/25 px-2.5 py-1">
            <Sparkles size={11} className="text-primary" />
            <span className="text-[11px] font-medium text-primary/90">AI Active</span>
          </div>
        </div>

        <div className="flex-1" />

        <button
          type="button"
          onClick={onOpenPalette}
          className="hidden md:inline-flex items-center gap-2 h-9 w-72 px-3 rounded-lg border border-border/60 bg-secondary/40 text-sm text-muted-foreground hover:text-foreground hover:border-primary/40 hover:bg-secondary/70 transition"
          aria-label="Abrir busca global"
        >
          <Search size={14} />
          <span className="flex-1 text-left">Buscar, executar ou perguntar…</span>
          <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded border border-border/60 bg-background/60">
            <Command size={10} /> K
          </span>
        </button>

        <Button variant="ghost" size="icon" onClick={onOpenPalette} className="md:hidden" aria-label="Busca">
          <Search size={18} />
        </Button>
        <Button variant="ghost" size="icon" onClick={onOpenNotifications} aria-label="Notificações" className="relative">
          <Bell size={18} />
          <span className="absolute top-2 right-2 h-1.5 w-1.5 rounded-full bg-primary zenno-pulse-dot" />
        </Button>
        <button
          type="button"
          onClick={onOpenCopilot}
          className="group inline-flex items-center gap-2 h-9 px-3.5 rounded-lg bg-gradient-to-r from-primary to-accent text-primary-foreground text-sm font-medium shadow-[0_0_20px_-6px_oklch(0.72_0.18_235/0.6)] hover:shadow-[0_0_28px_-4px_oklch(0.72_0.18_235/0.75)] transition-all"
          aria-label="Abrir Copilot"
        >
          <Activity size={13} className="opacity-90 group-hover:animate-pulse" />
          <span className="hidden sm:inline">Copilot</span>
        </button>

        <div className="ml-1 h-9 w-9 rounded-full bg-gradient-to-br from-primary/30 to-accent/30 border border-primary/30 grid place-items-center text-xs font-semibold text-foreground">
          {initial}
        </div>
      </div>
    </header>
  );
}
