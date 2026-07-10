// EPIC K.2 — CommandPalette (CTRL+K)
// Uses local `command` primitive and existing workspace command engine domain.

import { useNavigate } from "@tanstack/react-router";
import {
  CommandDialog, CommandInput, CommandList, CommandEmpty,
  CommandGroup, CommandItem,
} from "@/components/ui/command";
import { LayoutDashboard, FileBarChart, Lightbulb, Sparkles, Brain, PlayCircle, Layers } from "lucide-react";

const routes = [
  { path: "/app/workspace", label: "Visão Geral", icon: Layers },
  { path: "/app/workspace/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { path: "/app/workspace/reports", label: "Relatórios", icon: FileBarChart },
  { path: "/app/workspace/recommendations", label: "Recomendações", icon: Lightbulb },
  { path: "/app/workspace/insights", label: "Insights", icon: Sparkles },
  { path: "/app/workspace/memory", label: "Memória", icon: Brain },
  { path: "/app/workspace/actions", label: "Action Center", icon: PlayCircle },
] as const;

const HISTORY_KEY = "zenno.cmd.history";

function pushHistory(path: string) {
  try {
    const cur = JSON.parse(localStorage.getItem(HISTORY_KEY) ?? "[]") as string[];
    const next = [path, ...cur.filter((p) => p !== path)].slice(0, 8);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
  } catch { /* ignore */ }
}

export function readCommandHistory(): string[] {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY) ?? "[]") as string[]; }
  catch { return []; }
}

export function CommandPalette({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const navigate = useNavigate();

  const go = (path: string) => {
    pushHistory(path);
    onOpenChange(false);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    navigate({ to: path as any });
  };

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Buscar rotas, widgets, ações…" aria-label="Buscar" />
      <CommandList aria-live="polite" aria-busy={false}>

        <CommandEmpty>Nada encontrado.</CommandEmpty>
        <CommandGroup heading="Navegar">
          {routes.map((r) => (
            <CommandItem key={r.path} value={r.label} onSelect={() => go(r.path)}>
              <r.icon className="mr-2 h-4 w-4" />
              <span>{r.label}</span>
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
