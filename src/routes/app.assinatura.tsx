import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import {
  AlertCircle,
  ArrowDownCircle,
  ArrowUpCircle,
  Ban,
  Check,
  CheckCircle2,
  Clock,
  CreditCard,
  History,
  Loader2,
  Receipt,
  Sparkles,
  XCircle,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { listPlans, type PlanRow } from "@/lib/plans.functions";
import {
  cancelSubscription,
  changePlan,
  getSubscription,
  listSubscriptionEvents,
  startCheckout,
} from "@/lib/subscription.functions";
import {
  canCancel,
  computeRenewalInfo,
  computeTrialInfo,
  extractFeatureList,
  extractLimits,
  findCurrentPlan,
  formatCurrencyCents,
  labelForEvent,
  toneForEvent,
  type SubscriptionEventLike,
  type SubscriptionLike,
} from "@/lib/portal.helpers";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app/assinatura")({
  component: CustomerPortalPage,
});

function CustomerPortalPage() {
  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      <header>
        <h1 className="text-3xl font-bold">Portal do Cliente</h1>
        <p className="text-muted-foreground">
          Gerencie sua assinatura, planos, cobranças e histórico
        </p>
      </header>

      <Tabs defaultValue="dashboard" className="space-y-6">
        <TabsList>
          <TabsTrigger value="dashboard">
            <CreditCard className="h-4 w-4 mr-2" />
            Assinatura
          </TabsTrigger>
          <TabsTrigger value="plans">
            <Sparkles className="h-4 w-4 mr-2" />
            Planos
          </TabsTrigger>
          <TabsTrigger value="history">
            <History className="h-4 w-4 mr-2" />
            Histórico
          </TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard">
          <SubscriptionDashboard />
        </TabsContent>
        <TabsContent value="plans">
          <PlansSection />
        </TabsContent>
        <TabsContent value="history">
          <EventsHistory />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ---------------- Dashboard ----------------

function SubscriptionDashboard() {
  const fetchSub = useServerFn(getSubscription);
  const fetchPlans = useServerFn(listPlans);
  const cancelFn = useServerFn(cancelSubscription);
  const qc = useQueryClient();

  const subQ = useQuery({ queryKey: ["subscription"], queryFn: () => fetchSub() });
  const plansQ = useQuery({ queryKey: ["plans", "auth"], queryFn: () => fetchPlans() });

  const cancelMut = useMutation({
    mutationFn: (atPeriodEnd: boolean) =>
      cancelFn({ data: { atPeriodEnd } }),
    onSuccess: () => {
      toast.success("Assinatura cancelada");
      qc.invalidateQueries({ queryKey: ["subscription"] });
      qc.invalidateQueries({ queryKey: ["subscription-events"] });
    },
    onError: (e: unknown) =>
      toast.error(e instanceof Error ? e.message : "Erro ao cancelar"),
  });

  if (subQ.isLoading) return <DashboardSkeleton />;
  if (subQ.error) {
    return (
      <ErrorState
        title="Não foi possível carregar a assinatura"
        description={
          subQ.error instanceof Error ? subQ.error.message : "Erro desconhecido"
        }
        onRetry={() => subQ.refetch()}
      />
    );
  }

  const sub = (subQ.data?.subscription ?? null) as SubscriptionLike | null;
  const plans = (plansQ.data?.plans ?? []) as PlanRow[];
  const currentPlan = findCurrentPlan(plans, sub);
  const trial = computeTrialInfo(sub);
  const renewal = computeRenewalInfo(sub);
  const limits = extractLimits(currentPlan);

  return (
    <div className="space-y-6">
      <Card className="border-primary/40 bg-gradient-to-br from-primary/10 to-accent/5">
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                Plano atual:{" "}
                <span className="capitalize">
                  {currentPlan?.name ?? sub?.plan ?? "—"}
                </span>
              </CardTitle>
              <CardDescription className="flex items-center gap-2 mt-1">
                Status:{" "}
                <StatusBadge status={sub?.status ?? "unknown"} />
                {sub?.cancel_at_period_end && (
                  <Badge variant="outline" className="border-warning/40">
                    Cancelamento agendado
                  </Badge>
                )}
              </CardDescription>
            </div>
            {currentPlan && currentPlan.price_cents > 0 && (
              <div className="text-right">
                <div className="text-2xl font-bold">
                  {formatCurrencyCents(currentPlan.price_cents, currentPlan.currency)}
                </div>
                <div className="text-xs text-muted-foreground">
                  por {currentPlan.interval === "month" ? "mês" : "ano"}
                </div>
              </div>
            )}
          </div>
        </CardHeader>
      </Card>

      <div className="grid md:grid-cols-3 gap-4">
        {trial.inTrial && (
          <InfoCard
            icon={<Clock className="h-4 w-4" />}
            label="Período de teste"
            value={`${trial.daysLeft} dias`}
            hint={
              trial.endsAt
                ? `Termina em ${new Date(trial.endsAt).toLocaleDateString("pt-BR")}`
                : undefined
            }
          />
        )}
        {renewal.nextChargeAt && (
          <InfoCard
            icon={<Receipt className="h-4 w-4" />}
            label={renewal.willRenew ? "Próxima cobrança" : "Acesso até"}
            value={new Date(renewal.nextChargeAt).toLocaleDateString("pt-BR")}
            hint={
              renewal.willRenew
                ? `Renova em ${renewal.daysLeft} dias`
                : "Não haverá renovação automática"
            }
          />
        )}
        <InfoCard
          icon={<CheckCircle2 className="h-4 w-4" />}
          label="Limite do plano"
          value={
            limits.length > 0
              ? `${limits.length} recurso(s)`
              : "Sem limites configurados"
          }
          hint={
            limits.length > 0
              ? limits.map((l) => `${l.key}: ${l.value}`).join(" · ")
              : undefined
          }
        />
      </div>

      {sub?.cancel_at_period_end && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Cancelamento agendado</AlertTitle>
          <AlertDescription>
            Sua assinatura permanece ativa até{" "}
            {renewal.nextChargeAt
              ? new Date(renewal.nextChargeAt).toLocaleDateString("pt-BR")
              : "o fim do período pago"}
            .
          </AlertDescription>
        </Alert>
      )}

      {canCancel(sub) && (
        <div className="flex justify-end">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="sm" disabled={cancelMut.isPending}>
                {cancelMut.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Ban className="h-4 w-4 mr-2" />
                )}
                Cancelar assinatura
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Cancelar assinatura?</AlertDialogTitle>
                <AlertDialogDescription>
                  Você continuará com acesso completo até o fim do período pago.
                  Nenhuma nova cobrança será feita.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Manter assinatura</AlertDialogCancel>
                <AlertDialogAction onClick={() => cancelMut.mutate(true)}>
                  Confirmar cancelamento
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      )}
    </div>
  );
}

function InfoCard({
  icon,
  label,
  value,
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardDescription className="flex items-center gap-2">
          {icon}
          {label}
        </CardDescription>
        <CardTitle className="text-xl">{value}</CardTitle>
      </CardHeader>
      {hint && (
        <CardContent className="pt-0">
          <p className="text-xs text-muted-foreground">{hint}</p>
        </CardContent>
      )}
    </Card>
  );
}

function StatusBadge({ status }: { status: string }) {
  const s = status.toLowerCase();
  const variant: "default" | "outline" | "secondary" | "destructive" =
    s === "active"
      ? "default"
      : s === "trialing"
        ? "secondary"
        : s === "cancelled" || s === "canceled"
          ? "destructive"
          : "outline";
  return <Badge variant={variant}>{status}</Badge>;
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-32 w-full" />
      <div className="grid md:grid-cols-3 gap-4">
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
      </div>
    </div>
  );
}

// ---------------- Plans ----------------

function PlansSection() {
  const fetchPlans = useServerFn(listPlans);
  const fetchSub = useServerFn(getSubscription);
  const checkoutFn = useServerFn(startCheckout);
  const changePlanFn = useServerFn(changePlan);
  const qc = useQueryClient();

  const plansQ = useQuery({ queryKey: ["plans", "auth"], queryFn: () => fetchPlans() });
  const subQ = useQuery({ queryKey: ["subscription"], queryFn: () => fetchSub() });

  const [pendingCode, setPendingCode] = useState<string | null>(null);

  const checkoutMut = useMutation({
    mutationFn: async (planCode: string) => {
      setPendingCode(planCode);
      const origin = window.location.origin;
      return checkoutFn({
        data: {
          planCode,
          successUrl: `${origin}/app/assinatura?checkout=success`,
          cancelUrl: `${origin}/app/assinatura?checkout=cancel`,
        },
      });
    },
    onSuccess: (res: { url: string }) => {
      toast.success("Checkout iniciado. Redirecionando…");
      window.location.href = res.url;
    },
    onError: (e: unknown) => {
      setPendingCode(null);
      toast.error(
        e instanceof Error ? e.message : "Não foi possível iniciar o checkout",
      );
    },
  });

  const legacyMut = useMutation({
    mutationFn: (plan: string) => changePlanFn({ data: { plan } }),
    onSuccess: () => {
      toast.success("Plano atualizado");
      qc.invalidateQueries({ queryKey: ["subscription"] });
      qc.invalidateQueries({ queryKey: ["subscription-events"] });
      setPendingCode(null);
    },
    onError: (e: unknown) => {
      setPendingCode(null);
      toast.error(e instanceof Error ? e.message : "Erro ao alterar plano");
    },
  });

  if (plansQ.isLoading) {
    return (
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        <Skeleton className="h-72" />
        <Skeleton className="h-72" />
        <Skeleton className="h-72" />
      </div>
    );
  }
  if (plansQ.error) {
    return (
      <ErrorState
        title="Não foi possível carregar os planos"
        description={
          plansQ.error instanceof Error ? plansQ.error.message : "Erro desconhecido"
        }
        onRetry={() => plansQ.refetch()}
      />
    );
  }

  const plans = (plansQ.data?.plans ?? []).filter((p) => p.active);
  if (plans.length === 0) {
    return (
      <EmptyState
        icon={<Sparkles className="h-8 w-8" />}
        title="Nenhum plano disponível"
        description="Ainda não há planos publicados. Fale com o suporte."
      />
    );
  }

  const sub = (subQ.data?.subscription ?? null) as SubscriptionLike | null;
  const currentCode = sub?.plan ?? null;

  return (
    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
      {plans.map((plan) => {
        const isCurrent = plan.code === currentCode;
        const isFree = (plan.price_cents ?? 0) === 0;
        const busy = pendingCode === plan.code &&
          (checkoutMut.isPending || legacyMut.isPending);
        return (
          <PlanCard
            key={plan.id}
            plan={plan}
            isCurrent={isCurrent}
            busy={busy}
            onSelect={() => {
              if (isCurrent) return;
              if (isFree) legacyMut.mutate(plan.code);
              else checkoutMut.mutate(plan.code);
            }}
          />
        );
      })}
    </div>
  );
}

function PlanCard({
  plan,
  isCurrent,
  busy,
  onSelect,
}: {
  plan: PlanRow;
  isCurrent: boolean;
  busy: boolean;
  onSelect: () => void;
}) {
  const features = extractFeatureList(plan);
  const limits = extractLimits(plan);
  const highlight = plan.sort_order >= 20 && !isCurrent;
  return (
    <Card
      className={cn(
        highlight && "border-primary shadow-lg shadow-primary/10",
        isCurrent && "border-primary/60 bg-primary/5",
      )}
    >
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>{plan.name}</CardTitle>
          {isCurrent && <Badge>Plano atual</Badge>}
          {!isCurrent && highlight && (
            <Badge variant="secondary">Recomendado</Badge>
          )}
        </div>
        {plan.description && (
          <CardDescription>{plan.description}</CardDescription>
        )}
        <div className="text-3xl font-bold mt-2">
          {plan.price_cents === 0
            ? "Grátis"
            : formatCurrencyCents(plan.price_cents, plan.currency)}
          {plan.price_cents > 0 && (
            <span className="text-sm font-normal text-muted-foreground">
              /{plan.interval === "month" ? "mês" : "ano"}
            </span>
          )}
        </div>
        {plan.trial_days > 0 && (
          <p className="text-xs text-muted-foreground">
            {plan.trial_days} dias de teste grátis
          </p>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {features.length > 0 && (
          <ul className="space-y-2">
            {features.map((f) => (
              <li key={f} className="flex items-start gap-2 text-sm">
                <Check className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                <span>{f}</span>
              </li>
            ))}
          </ul>
        )}
        {limits.length > 0 && (
          <div className="text-xs text-muted-foreground space-y-1 border-t pt-2">
            {limits.map((l) => (
              <div key={l.key} className="flex justify-between">
                <span className="capitalize">{l.key}</span>
                <span className="font-medium">{l.value}</span>
              </div>
            ))}
          </div>
        )}
        <Button
          className="w-full"
          variant={highlight ? "default" : "outline"}
          disabled={isCurrent || busy}
          onClick={onSelect}
        >
          {busy ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Processando…
            </>
          ) : isCurrent ? (
            "Plano ativo"
          ) : (
            `Assinar ${plan.name}`
          )}
        </Button>
      </CardContent>
    </Card>
  );
}

// ---------------- Events ----------------

function EventsHistory() {
  const fetchEvents = useServerFn(listSubscriptionEvents);
  const q = useQuery({
    queryKey: ["subscription-events"],
    queryFn: () => fetchEvents(),
  });

  if (q.isLoading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-14" />
        <Skeleton className="h-14" />
        <Skeleton className="h-14" />
        <Skeleton className="h-14" />
      </div>
    );
  }
  if (q.error) {
    return (
      <ErrorState
        title="Não foi possível carregar o histórico"
        description={
          q.error instanceof Error ? q.error.message : "Erro desconhecido"
        }
        onRetry={() => q.refetch()}
      />
    );
  }

  const events = (q.data?.events ?? []) as SubscriptionEventLike[];
  if (events.length === 0) {
    return (
      <EmptyState
        icon={<History className="h-8 w-8" />}
        title="Nenhum evento ainda"
        description="Ativações, upgrades, cancelamentos e cobranças aparecerão aqui."
      />
    );
  }

  return (
    <Card>
      <CardContent className="p-0">
        <ul className="divide-y">
          {events.map((ev) => (
            <EventRow key={ev.id} event={ev} />
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

function EventRow({ event }: { event: SubscriptionEventLike }) {
  const tone = toneForEvent(event.event_type);
  const Icon =
    tone === "positive"
      ? ArrowUpCircle
      : tone === "negative"
        ? XCircle
        : tone === "warning"
          ? ArrowDownCircle
          : Receipt;
  const toneClass =
    tone === "positive"
      ? "text-primary"
      : tone === "negative"
        ? "text-destructive"
        : tone === "warning"
          ? "text-warning"
          : "text-muted-foreground";
  return (
    <li className="flex items-center gap-4 p-4">
      <Icon className={cn("h-5 w-5 shrink-0", toneClass)} />
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm">{labelForEvent(event.event_type)}</p>
        <p className="text-xs text-muted-foreground truncate">
          {event.from_plan_code && event.to_plan_code
            ? `${event.from_plan_code} → ${event.to_plan_code}`
            : event.to_plan_code
              ? `Plano: ${event.to_plan_code}`
              : event.provider
                ? `Provedor: ${event.provider}`
                : "—"}
        </p>
      </div>
      <time className="text-xs text-muted-foreground whitespace-nowrap">
        {new Date(event.created_at).toLocaleString("pt-BR")}
      </time>
    </li>
  );
}

// ---------------- Shared ----------------

function ErrorState({
  title,
  description,
  onRetry,
}: {
  title: string;
  description: string;
  onRetry: () => void;
}) {
  return (
    <Alert variant="destructive">
      <AlertCircle className="h-4 w-4" />
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription className="flex items-center justify-between gap-4">
        <span>{description}</span>
        <Button size="sm" variant="outline" onClick={onRetry}>
          Tentar novamente
        </Button>
      </AlertDescription>
    </Alert>
  );
}

function EmptyState({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <Card>
      <CardContent className="py-12 flex flex-col items-center gap-2 text-center">
        <div className="text-muted-foreground">{icon}</div>
        <h3 className="font-semibold">{title}</h3>
        <p className="text-sm text-muted-foreground max-w-md">{description}</p>
      </CardContent>
    </Card>
  );
}
