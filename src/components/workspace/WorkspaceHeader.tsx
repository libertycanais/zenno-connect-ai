// Invisible UI — minimal header. Search + Copilot only.
import { Command, Search } from "lucide-react";

type Props = {
  title?: string;
  onOpenPalette: () => void;
  onOpenCopilot: () => void;
  onOpenNotifications: () => void;
};

export function WorkspaceHeader({ title, onOpenPalette, onOpenCopilot }: Props) {
  return (
    <header className="sticky top-0 z-20 h-14 border-b border-border/40 bg-background/80 backdrop-blur-xl">
      <div className="mx-auto max-w-6xl h-full flex items-center gap-6 px-6 md:px-10">
        <span className="text-[13px] font-medium text-foreground/90">{title ?? "Zenno"}</span>
        <div className="flex-1" />
        <button
          type="button"
          onClick={onOpenPalette}
          className="inline-flex items-center gap-2 h-8 px-2.5 rounded-md text-[12px] text-muted-foreground hover:text-foreground transition"
          aria-label="Buscar"
        >
          <Search size={13} />
          <span className="hidden sm:inline">Buscar</span>
          <span className="hidden sm:inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded border border-border/50">
            <Command size={9} /> K
          </span>
        </button>
        <button
          type="button"
          onClick={onOpenCopilot}
          className="text-[12px] text-foreground/80 hover:text-foreground transition"
        >
          Copilot
        </button>
      </div>
    </header>
  );
}
