// Sprint 5.3 — Metrics scrape endpoint.
// Protected by a shared bearer token from METRICS_TOKEN env var.
// If METRICS_TOKEN is not set, endpoint returns 503 — fail closed.
//
// Contract: GET /api/public/metrics
//   Header: Authorization: Bearer <METRICS_TOKEN>
//   200 -> JSON snapshot { timestamp, counters[], histograms[] }
//   401 -> missing/invalid token
//   503 -> METRICS_TOKEN not configured
//
// Não retorna PII. Nomes de métricas e labels são não-sensíveis por design.

import { createFileRoute } from "@tanstack/react-router";

import { snapshot } from "@/lib/observability/metrics";

export const Route = createFileRoute("/api/public/metrics")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const token = process.env.METRICS_TOKEN;
        if (!token || token.length < 16) {
          return new Response(
            JSON.stringify({ error: "metrics_disabled" }),
            {
              status: 503,
              headers: { "content-type": "application/json" },
            },
          );
        }

        const auth = request.headers.get("authorization") ?? "";
        const provided = auth.startsWith("Bearer ") ? auth.slice(7) : "";
        // Constant-time compare
        if (
          provided.length !== token.length ||
          !safeEqual(provided, token)
        ) {
          return new Response(
            JSON.stringify({ error: "unauthorized" }),
            {
              status: 401,
              headers: { "content-type": "application/json" },
            },
          );
        }

        return new Response(JSON.stringify(snapshot()), {
          status: 200,
          headers: {
            "content-type": "application/json",
            "cache-control": "no-store",
          },
        });
      },
    },
  },
});

function safeEqual(a: string, b: string): boolean {
  let diff = a.length ^ b.length;
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
