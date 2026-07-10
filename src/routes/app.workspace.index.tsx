// EPIC K.2 — /app/workspace (Overview)
import { createFileRoute } from "@tanstack/react-router";
import { WorkspaceShell } from "@/components/workspace/WorkspaceShell";
import { WorkspaceGrid } from "@/components/workspace/WorkspaceGrid";
import {
  ExecutiveScoreWidget, RecommendationsWidget, InsightsWidget, SignalsWidget,
  TimelineWidget, NotificationsWidget,
} from "@/components/workspace/widgets";

export const Route = createFileRoute("/app/workspace/")({ component: WorkspaceOverview });

function WorkspaceOverview() {
  return (
    <WorkspaceShell title="Zenno OS · Visão Geral">
      <WorkspaceGrid>
        <ExecutiveScoreWidget />
        <RecommendationsWidget />
        <InsightsWidget />
        <SignalsWidget />
        <TimelineWidget />
        <NotificationsWidget />
      </WorkspaceGrid>
    </WorkspaceShell>
  );
}
