// Invisible UI — minimal shell. AppShell already provides the single sidebar.
import { type ReactNode, useState, useCallback, useEffect } from "react";
import { WorkspaceHeader } from "./WorkspaceHeader";
import { CommandPalette } from "./CommandPalette";
import { CopilotDrawer } from "./CopilotDrawer";
import { NotificationDrawer } from "./NotificationDrawer";
import { BootScreen, BOOT_FLAG } from "@/components/experience/BootScreen";

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
    <div className="min-h-dvh bg-background text-foreground">
      <WorkspaceHeader
        title={title}
        onOpenPalette={togglePalette}
        onOpenCopilot={toggleCopilot}
        onOpenNotifications={() => setNotifOpen(true)}
      />
      <main className="mx-auto w-full max-w-6xl px-6 md:px-10 py-12 md:py-16">{children}</main>
      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
      <CopilotDrawer open={copilotOpen} onOpenChange={setCopilotOpen} />
      <NotificationDrawer open={notifOpen} onOpenChange={setNotifOpen} />
      {booting && <BootScreen onDone={() => setBooting(false)} />}
    </div>
  );
}
