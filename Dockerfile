# syntax=docker/dockerfile:1.7
# ==============================================================================
# Zenno SaaS — Dockerfile (deploy externo — Node runtime)
# ------------------------------------------------------------------------------
# Este arquivo NÃO afeta o build padrão do Lovable/Cloudflare Workers.
# Ele existe para permitir deploy em VPS/Coolify/Railway/Render/Fly/K8s.
# Build local:   docker build -t zenno-app .
# Rodar isolado: docker run --env-file .env -p 3000:3000 zenno-app
# Stack completo: docker compose up
# ==============================================================================

# ---- Stage 1: dependências ---------------------------------------------------
FROM oven/bun:1.1-alpine AS deps
WORKDIR /app
COPY package.json bun.lock* package-lock.json* ./
RUN bun install --frozen-lockfile

# ---- Stage 2: build (Nitro node-server) --------------------------------------
FROM oven/bun:1.1-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Força preset Node em vez de Cloudflare Workers (default do template).
ENV NITRO_PRESET=node-server
ENV NODE_ENV=production

# Variáveis VITE_* precisam existir no build (embebidas no bundle client).
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_PUBLISHABLE_KEY
ARG VITE_SUPABASE_PROJECT_ID
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_PUBLISHABLE_KEY=$VITE_SUPABASE_PUBLISHABLE_KEY
ENV VITE_SUPABASE_PROJECT_ID=$VITE_SUPABASE_PROJECT_ID

RUN bun run build

# ---- Stage 3: runtime --------------------------------------------------------
FROM node:20-alpine AS runner
WORKDIR /app

# Usuário não-root
RUN addgroup -S zenno && adduser -S zenno -G zenno

ENV NODE_ENV=production
ENV PORT=3000
ENV SERVICE_NAME=zenno-api

# Copia apenas o build Nitro (server + client + public).
COPY --from=builder --chown=zenno:zenno /app/.output ./.output

USER zenno
EXPOSE 3000

# Healthcheck nativo Docker apontando pro endpoint /live (sem depender de DB).
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://127.0.0.1:${PORT}/api/public/live || exit 1

CMD ["node", ".output/server/index.mjs"]
