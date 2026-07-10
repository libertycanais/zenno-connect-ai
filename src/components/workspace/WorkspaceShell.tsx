// EPIC K.2 — WorkspaceShell
// Additive shell that composes header/sidebar/main + drawers.
// Reuses AppShell auth (route already protected) and Zenno OS engines.

import { type ReactNode, useState, useCallback, useEffect } from "react";
import { WorkspaceHeader } from "./WorkspaceHeader";
import { WorkspaceSidebar } from "./WorkspaceSidebar";
import { CommandPalette } from "./CommandPalette";
import { CopilotDrawer } from "./CopilotDrawer";
import { NotificationDrawer } from "./NotificationDrawer";

export function WorkspaceShell({ children, title }: { children: ReactNode; title?: string }) {
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [copilotOpen, setCopilotOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);

  const togglePalette = useCallback(() => setPaletteOpen((v) => !v), []);
  const toggleCopilot = useCallback(() => setCopilotOpen((v) => !v), []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "j") {
        e.preventDefault();
        setCopilotOpen((v) => !v);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="flex min-h-[calc(100vh-0px)] bg-background text-foreground">
      <WorkspaceSidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <WorkspaceHeader
          title={title}
          onOpenPalette={togglePalette}
          onOpenCopilot={toggleCopilot}
          onOpenNotifications={() => setNotifOpen(true)}
        />
        <main className="flex-1 p-4 md:p-6 overflow-x-hidden">{children}</main>
      </div>
      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
      <CopilotDrawer open={copilotOpen} onOpenChange={setCopilotOpen} />
      <NotificationDrawer open={notifOpen} onOpenChange={setNotifOpen} />
    </div>
  );
}
