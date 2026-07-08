// Health geral — versão + uptime. Não bloqueia por dependências.
// Para prontidão real de tráfego, use /api/public/ready.
import { createFileRoute } from "@tanstack/react-router";

const BOOT_TIME = Date.now();

export const Route = createFileRoute("/api/public/health")({
  server: {
    handlers: {
      GET: async () =>
        Response.json(
          {
            status: "ok",
            service: process.env.SERVICE_NAME ?? "zenno-api",
            version:
              process.env.APP_VERSION ?? process.env.GIT_SHA ?? "dev",
            environment:
              process.env.APP_ENV ?? process.env.NODE_ENV ?? "development",
            uptime_seconds: Math.floor((Date.now() - BOOT_TIME) / 1000),
            timestamp: new Date().toISOString(),
          },
          { status: 200 },
        ),
    },
  },
});
