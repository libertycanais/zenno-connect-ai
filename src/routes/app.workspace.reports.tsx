// EPIC K.2 — /app/workspace/reports
import { createFileRoute } from "@tanstack/react-router";
import { WorkspaceShell } from "@/components/workspace/WorkspaceShell";
import { WorkspaceGrid } from "@/components/workspace/WorkspaceGrid";
import {
  ExecutiveScoreWidget, InsightsWidget, TimelineWidget, ForecastWidget,
  ConsensusWidget, LearningWidget,
} from "@/components/workspace/widgets";

export const Route = createFileRoute("/app/workspace/reports")({ component: ReportsPage });

function ReportsPage() {
  return (
    <WorkspaceShell title="Zenno OS · Relatórios">
      <WorkspaceGrid>
        <ExecutiveScoreWidget />
        <InsightsWidget />
        <TimelineWidget />
        <ForecastWidget />
        <ConsensusWidget />
        <LearningWidget />
      </WorkspaceGrid>
    </WorkspaceShell>
  );
}
