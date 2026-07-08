// Liveness probe — "o processo está vivo?".
// Não consulta banco, redis, nem integrações. HTTP 200 sempre que o handler executa.
// Kubernetes: livenessProbe.httpGet.path = /api/public/live
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/live")({
  server: {
    handlers: {
      GET: async () =>
        Response.json(
          { status: "ok", timestamp: new Date().toISOString() },
          { status: 200 },
        ),
    },
  },
});
