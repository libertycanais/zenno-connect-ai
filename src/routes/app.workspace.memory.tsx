// EPIC K.2 — /app/workspace/memory
import { createFileRoute } from "@tanstack/react-router";
import { WorkspaceShell } from "@/components/workspace/WorkspaceShell";
import { WorkspaceGrid } from "@/components/workspace/WorkspaceGrid";
import { MemoryWidget, BusinessDNAWidget, LearningWidget } from "@/components/workspace/widgets";

export const Route = createFileRoute("/app/workspace/memory")({ component: MemoryPage });

function MemoryPage() {
  return (
    <WorkspaceShell title="Zenno OS · Memória">
      <WorkspaceGrid>
        <MemoryWidget />
        <BusinessDNAWidget />
        <LearningWidget />
      </WorkspaceGrid>
    </WorkspaceShell>
  );
}
