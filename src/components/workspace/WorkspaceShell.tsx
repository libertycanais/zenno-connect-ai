// EPIC K.2 — WorkspaceShell
// Additive shell that composes header/sidebar/main + drawers.
// Reuses AppShell auth (route already protected) and Zenno OS engines.

import { type ReactNode, useState, useCallback, useEffect } from "react";
import { WorkspaceHeader } from "./WorkspaceHeader";
import { WorkspaceSidebar } from "./WorkspaceSidebar";
import { CommandPalette } from "./CommandPalette";
import { CopilotDrawer } from "./CopilotDrawer";
import { NotificationDrawer } from "./NotificationDrawer";
import { BootScreen, BOOT_FLAG } from "@/components/experience/BootScreen";
import { DynamicBackground } from "@/components/experience/DynamicBackground";
import { LiveIntelligenceFeed } from "@/components/experience/LiveIntelligenceFeed";

export function WorkspaceShell({ children, title }: { children: ReactNode; title?: string }) {
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [copilotOpen, setCopilotOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [booting, setBooting] = useState(false);

  useEffect(() => {
    try {
      if (sessionStorage.getItem(BOOT_FLAG) === "1") {
        setBooting(true);
        sessionStorage.removeItem(BOOT_FLAG);
      }
    } catch { /* noop */ }
  }, []);

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
    <div className="flex min-h-dvh bg-background text-foreground relative">
      <div className="pointer-events-none fixed inset-0 zenno-ambient opacity-80" aria-hidden />
      <WorkspaceSidebar />
      <div className="flex-1 flex flex-col min-w-0 relative">
        <WorkspaceHeader
          title={title}
          onOpenPalette={togglePalette}
          onOpenCopilot={toggleCopilot}
          onOpenNotifications={() => setNotifOpen(true)}
        />
        <main className="flex-1 p-6 md:p-8 overflow-x-hidden zenno-fade-up">{children}</main>
      </div>
      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
      <CopilotDrawer open={copilotOpen} onOpenChange={setCopilotOpen} />
      <NotificationDrawer open={notifOpen} onOpenChange={setNotifOpen} />
      {booting && <BootScreen onDone={() => setBooting(false)} />}
    </div>
  );
}
