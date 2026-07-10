// EPIC K.2 — /app/workspace layout (com Outlet)
import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/app/workspace")({ component: () => <Outlet /> });
