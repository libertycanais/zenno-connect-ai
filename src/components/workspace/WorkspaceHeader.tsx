// EPIC K.2 — WorkspaceHeader (breadcrumbs, quick actions, palette/copilot triggers)
import { Bell, Command, Sparkles, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type Props = {
  title?: string;
  onOpenPalette: () => void;
  onOpenCopilot: () => void;
  onOpenNotifications: () => void;
};

export function WorkspaceHeader({ title, onOpenPalette, onOpenCopilot, onOpenNotifications }: Props) {
  return (
    <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-border/60 bg-background/80 px-4 backdrop-blur">
      <div className="flex min-w-0 items-center gap-2">
        <span className="text-sm font-semibold text-foreground truncate">
          {title ?? "Zenno OS"}
        </span>
        <Badge variant="outline" className="hidden md:inline-flex">Workspace</Badge>
      </div>
      <div className="flex-1" />
      <button
        type="button"
        onClick={onOpenPalette}
        className="hidden md:inline-flex items-center gap-2 h-9 px-3 rounded-md border border-border bg-muted/40 text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition"
        aria-label="Abrir busca global"
      >
        <Search size={14} />
        <span>Buscar ou executar…</span>
        <span className="ml-3 inline-flex items-center gap-1 text-xs">
          <Command size={12} /> K
        </span>
      </button>
      <Button variant="ghost" size="icon" onClick={onOpenPalette} className="md:hidden" aria-label="Busca">
        <Search size={18} />
      </Button>
      <Button variant="ghost" size="icon" onClick={onOpenNotifications} aria-label="Notificações">
        <Bell size={18} />
      </Button>
      <Button variant="secondary" size="sm" onClick={onOpenCopilot} className="gap-2">
        <Sparkles size={14} /> <span className="hidden sm:inline">Copilot</span>
      </Button>
    </header>
  );
}
