// EPIC K.2 — /app/workspace/insights
import { createFileRoute } from "@tanstack/react-router";
import { WorkspaceShell } from "@/components/workspace/WorkspaceShell";
import { WorkspaceGrid } from "@/components/workspace/WorkspaceGrid";
import { InsightsWidget, SignalsWidget, TimelineWidget, BusinessDNAWidget } from "@/components/workspace/widgets";

export const Route = createFileRoute("/app/workspace/insights")({ component: InsightsPage });

function InsightsPage() {
  return (
    <WorkspaceShell title="Zenno OS · Insights">
      <WorkspaceGrid>
        <InsightsWidget />
        <SignalsWidget />
        <TimelineWidget />
        <BusinessDNAWidget />
      </WorkspaceGrid>
    </WorkspaceShell>
  );
}
