// EPIC K.2 — /app/workspace/recommendations
import { createFileRoute } from "@tanstack/react-router";
import { WorkspaceShell } from "@/components/workspace/WorkspaceShell";
import { WorkspaceGrid } from "@/components/workspace/WorkspaceGrid";
import { RecommendationsWidget, InsightsWidget, NotificationsWidget } from "@/components/workspace/widgets";

export const Route = createFileRoute("/app/workspace/recommendations")({ component: RecommendationsPage });

function RecommendationsPage() {
  return (
    <WorkspaceShell title="Zenno OS · Recomendações">
      <WorkspaceGrid>
        <RecommendationsWidget />
        <InsightsWidget />
        <NotificationsWidget />
      </WorkspaceGrid>
    </WorkspaceShell>
  );
}
