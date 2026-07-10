// EPIC K.2 — WorkspaceGrid + WidgetContainer + WidgetToolbar + Loader/Empty/Error states
import { type ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { AlertTriangle, MoreHorizontal, Pin, Settings } from "lucide-react";

export function WorkspaceGrid({ children }: { children: ReactNode }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 [&>[data-widget-size=xl]]:col-span-full [&>[data-widget-size=lg]]:md:col-span-2">
      {children}
    </div>
  );
}


type WidgetProps = {
  title: string;
  subtitle?: string;
  onSettings?: () => void;
  onPin?: () => void;
  className?: string;
  children: ReactNode;
};

export function WidgetContainer({ title, subtitle, onSettings, onPin, className, children }: WidgetProps) {
  return (
    <Card className={"overflow-hidden " + (className ?? "")} data-widget="1">
      <CardHeader className="flex-row items-start justify-between gap-2 pb-2">
        <div className="min-w-0">
          <CardTitle className="text-sm font-semibold truncate">{title}</CardTitle>
          {subtitle && <p className="text-xs text-muted-foreground truncate">{subtitle}</p>}
        </div>
        <WidgetToolbar onSettings={onSettings} onPin={onPin} />
      </CardHeader>
      <CardContent className="pt-2">{children}</CardContent>
    </Card>
  );
}

export function WidgetToolbar({ onSettings, onPin }: { onSettings?: () => void; onPin?: () => void }) {
  return (
    <div className="flex items-center gap-1 shrink-0">
      {onPin && (
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onPin} aria-label="Fixar widget">
          <Pin size={14} />
        </Button>
      )}
      {onSettings && (
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onSettings} aria-label="Configurar widget">
          <Settings size={14} />
        </Button>
      )}
      <Button variant="ghost" size="icon" className="h-7 w-7" aria-label="Mais opções">
        <MoreHorizontal size={14} />
      </Button>
    </div>
  );
}

export function WidgetLoader({ lines = 4 }: { lines?: number }) {
  return (
    <div className="space-y-2" role="status" aria-live="polite">
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} className="h-4 w-full" />
      ))}
    </div>
  );
}

export function WidgetEmpty({ message = "Sem dados disponíveis." }: { message?: string }) {
  return (
    <div className="py-6 text-center text-sm text-muted-foreground">{message}</div>
  );
}

export function WidgetError({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
      <AlertTriangle size={16} className="mt-0.5 shrink-0" />
      <div className="flex-1">
        <p className="font-medium">Não foi possível carregar</p>
        <p className="text-xs opacity-80">{message}</p>
        {onRetry && (
          <Button variant="outline" size="sm" onClick={onRetry} className="mt-2">
            Tentar novamente
          </Button>
        )}
      </div>
    </div>
  );
}
