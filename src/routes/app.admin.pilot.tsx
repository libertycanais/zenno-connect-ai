// RC2 Pilot Program — Pilot Dashboard (in-memory demo view using the pilot lib).
// Additive route; does not touch existing admin dashboard. Real DB wiring
// will land during pilot execution via server functions over pilot_* tables.
import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  computeAdoptionScore, computeHealthScore, computeNps, computeCsat,
  ONBOARDING_STEPS, computeOnboardingProgress,
} from "@/lib/pilot";
import { Activity, TrendingUp, Users, MessageSquare, Zap, ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/app/admin/pilot")({ component: PilotDashboard });

interface PilotCohortView {
  organizationName: string;
  cohort: string;
  status: string;
  activeDays: number;
  featuresUsed: number;
  eventCount: number;
  errorRate: number;
  crashRate: number;
  p95LatencyMs: number;
  npsScores: number[];
  csatScores: number[];
  aiCostUsd: number;
  ttfvSeconds: number | null;
  completedSteps: string[];
}

// Demo seed — replaced by server function pulling `pilot_*` tables during pilot exec.
const DEMO: PilotCohortView[] = [
  { organizationName: "Acme LTDA",       cohort: "wave-1", status: "active",     activeDays: 12, featuresUsed: 7, eventCount: 342, errorRate: 0.004, crashRate: 0,    p95LatencyMs: 220, npsScores: [10,9,9,8,10], csatScores: [5,4,5,5,4], aiCostUsd: 12.4, ttfvSeconds: 480, completedSteps: ["profile.completed","integration.whatsapp","workspace.dashboard","copilot.first_prompt"] },
  { organizationName: "Beta Growth",     cohort: "wave-1", status: "onboarding", activeDays: 4,  featuresUsed: 3, eventCount: 88,  errorRate: 0.01,  crashRate: 0.001,p95LatencyMs: 380, npsScores: [7,8],           csatScores: [4,3],       aiCostUsd: 3.1,  ttfvSeconds: 1240,completedSteps: ["profile.completed","integration.whatsapp"] },
  { organizationName: "Gamma Digital",   cohort: "wave-2", status: "active",     activeDays: 10, featuresUsed: 6, eventCount: 210, errorRate: 0.006, crashRate: 0,    p95LatencyMs: 290, npsScores: [9,10,8],        csatScores: [5,4,5],     aiCostUsd: 8.9,  ttfvSeconds: 620, completedSteps: ["profile.completed","integration.whatsapp","integration.ads","workspace.dashboard","copilot.first_prompt","recommendation.first"] },
];

function Kpi({ icon: Icon, label, value, hint, tone }: { icon: any; label: string; value: string; hint?: string; tone?: string }) {
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground uppercase tracking-wide">{label}</span>
        <Icon size={16} className="text-muted-foreground" />
      </div>
      <div className={`text-2xl font-bold mt-1 ${tone ?? ""}`}>{value}</div>
      {hint && <div className="text-xs text-muted-foreground mt-1">{hint}</div>}
    </Card>
  );
}

function PilotDashboard() {
  const [data] = useState<PilotCohortView[]>(DEMO);

  const rollup = useMemo(() => {
    const allNps = data.flatMap((d) => d.npsScores);
    const allCsat = data.flatMap((d) => d.csatScores);
    const totalCost = data.reduce((a, d) => a + d.aiCostUsd, 0);
    const avgP95 = data.length > 0 ? Math.round(data.reduce((a, d) => a + d.p95LatencyMs, 0) / data.length) : 0;
    const avgErr = data.length > 0 ? data.reduce((a, d) => a + d.errorRate, 0) / data.length : 0;
    const ttfvs = data.map((d) => d.ttfvSeconds).filter((v): v is number => v != null);
    const avgTtfv = ttfvs.length > 0 ? Math.round(ttfvs.reduce((a, b) => a + b, 0) / ttfvs.length) : null;
    return {
      nps: computeNps(allNps),
      csat: computeCsat(allCsat),
      totalCost,
      avgP95,
      avgErr,
      avgTtfv,
      active: data.filter((d) => d.status === "active").length,
      total: data.length,
    };
  }, [data]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">Pilot Dashboard</h1>
          <p className="text-xs text-muted-foreground">RC2 · Programa Piloto · Health, Adoption &amp; Feedback</p>
        </div>
        <Badge variant="secondary" className="gap-1"><Activity size={12}/> RC2 Ready</Badge>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <Kpi icon={Users}         label="Orgs Piloto"      value={`${rollup.active}/${rollup.total}`} hint="ativas / total" />
        <Kpi icon={TrendingUp}    label="NPS"              value={rollup.nps == null ? "—" : String(rollup.nps)} hint="agregado" />
        <Kpi icon={MessageSquare} label="CSAT"             value={rollup.csat == null ? "—" : rollup.csat.toFixed(2)} hint="0–5" />
        <Kpi icon={Zap}           label="TTFV médio"       value={rollup.avgTtfv == null ? "—" : `${rollup.avgTtfv}s`} hint="onboarding → 1º valor" />
        <Kpi icon={ShieldCheck}   label="p95 latência"     value={`${rollup.avgP95}ms`} hint={`err ${(rollup.avgErr*100).toFixed(2)}%`} />
        <Kpi icon={Activity}      label="Custo IA"         value={`$${rollup.totalCost.toFixed(2)}`} hint="acumulado" />
      </div>

      <div className="grid gap-3">
        {data.map((d) => {
          const health = computeHealthScore({
            errorRate: d.errorRate, crashRate: d.crashRate, p95LatencyMs: d.p95LatencyMs,
            npsAverage: d.npsScores.length ? (computeNps(d.npsScores) ?? null) : null,
            csatAverage: d.csatScores.length ? (computeCsat(d.csatScores) ?? null) : null,
            activeDays: d.activeDays,
          });
          const adoption = computeAdoptionScore({
            events: [], activeDays: d.activeDays,
            featuresUsed: new Set(Array.from({ length: d.featuresUsed }, (_, i) => `f${i}`)),
            totalFeatures: 10,
          });
          const onboarding = computeOnboardingProgress(d.completedSteps);
          return (
            <Card key={d.organizationName} className="p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{d.organizationName}</span>
                  <Badge variant="outline" className="text-xs">{d.cohort}</Badge>
                  <Badge variant="secondary" className="text-xs">{d.status}</Badge>
                </div>
                <div className="flex items-center gap-6 text-xs text-muted-foreground">
                  <div>Eventos: <span className="font-medium text-foreground">{d.eventCount}</span></div>
                  <div>Features: <span className="font-medium text-foreground">{d.featuresUsed}/{ONBOARDING_STEPS.length}</span></div>
                  <div>IA: <span className="font-medium text-foreground">${d.aiCostUsd.toFixed(2)}</span></div>
                </div>
              </div>
              <div className="grid md:grid-cols-3 gap-4 mt-3">
                <div>
                  <div className="flex justify-between text-xs mb-1"><span>Health</span><span className="font-medium">{health.toFixed(0)}</span></div>
                  <Progress value={health} />
                </div>
                <div>
                  <div className="flex justify-between text-xs mb-1"><span>Adoption</span><span className="font-medium">{adoption.toFixed(0)}</span></div>
                  <Progress value={adoption} />
                </div>
                <div>
                  <div className="flex justify-between text-xs mb-1"><span>Onboarding</span><span className="font-medium">{onboarding.percent}%</span></div>
                  <Progress value={onboarding.percent} />
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      <p className="text-xs text-muted-foreground">
        Dados exibidos são a semente demonstrativa do Pilot Dashboard (RC2). Quando organizações reais entrarem no piloto,
        os eventos gravados em <code>pilot_telemetry_events</code>, <code>pilot_feedback</code> e <code>pilot_onboarding_progress</code>
        substituem esta seed via server function agregadora.
      </p>
    </div>
  );
}
