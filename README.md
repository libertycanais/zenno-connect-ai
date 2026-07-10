# Zenno AI Suite — Enterprise

> Plataforma multi-tenant de Marketing Intelligence com Copilot de IA, dashboards executivos e conectores unificados (Google Marketing Platform, Meta, WhatsApp).

**Status:** RC2 — Pilot Program · **Architecture Freeze:** v1.0 · **Design:** LOCKED · **Fase:** Product Evolution

---

## 1. Visão de 30 segundos

Zenno é um **Operating System de Marketing** que conecta as plataformas do cliente (Google Ads/GA4/GTM/GSC/Merchant/Business Profile, Meta, etc.), sincroniza os dados, roda um **Marketing Intelligence Pipeline** por eventos e entrega:

- **Executive Score 0–100** com explicações em linguagem natural
- **AI Confidence Score** (confiabilidade da análise)
- **Recomendações** com Problema → Causa → Impacto → Próxima Ação
- **Copilot proativo** com Decision Trace
- **Workspace configurável** (Command Palette, widgets, notificações)

Toda análise passa pelo pipeline oficial:
`Knowledge → Business KPIs → Context → Provider Layer (Claude/LLM) → Recommendation → Playbook`

---

## 2. Stack técnica

| Camada | Tecnologia |
|---|---|
| Frontend | React 19, TanStack Router/Start, Tailwind v4, shadcn/ui, Framer Motion |
| Server | TanStack `createServerFn`, server routes em `src/routes/api/public/*` |
| Runtime | Cloudflare Workers (nodejs_compat) |
| Data | PostgreSQL 15 (Supabase-compatível), RLS 100%, multi-tenant `organization_id` |
| AI | Provider Layer (`AIProvider`, `PaymentProvider`, `AdsProvider`, `WhatsAppProvider`) |
| Testes | Vitest + Playwright (848+ testes verdes) |
| Observabilidade | Métricas in-memory + export Prometheus, Tracing, Sentry opcional |

Detalhes: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) · [`docs/ARCHITECTURE_DECISIONS.md`](docs/ARCHITECTURE_DECISIONS.md)

---

## 3. Como começar

```bash
bun install
bun run dev          # http://localhost:8080
bun run test         # Vitest
bunx tsgo --noEmit   # typecheck
bun run build
```

Variáveis obrigatórias: ver [`.env.staging.example`](.env.staging.example).

---

## 4. Documentação

Ponto de entrada: [`docs/INDEX.md`](docs/INDEX.md).

Documentos-chave:
- **Arquitetura:** `docs/ARCHITECTURE.md`, `docs/ARCHITECTURE_DECISIONS.md`, `docs/ARCHITECTURE_FREEZE.md`
- **Segurança:** `docs/SECURITY.md`, `docs/security/*`
- **Deploy/Operação:** `DEPLOYMENT.md`, `docs/DOCKER.md`, `docs/DEPLOY_CHECKLIST.md`, `docs/DISASTER_RECOVERY.md`, `docs/runbooks/*`
- **Engenharia:** `docs/ENGINEERING_HANDBOOK.md`, `docs/CODE_STYLE.md`, `CONTRIBUTING.md`
- **Produto/Design:** `docs/PRODUCT_BACKLOG.md`, `docs/DESIGN_GOLDEN_RULES.md`, `docs/BRAND_BOOK.md`
- **Manifesto:** [`PROJECT_MANIFEST.md`](PROJECT_MANIFEST.md)
- **Migração para stack própria:** [`docs/MIGRATION_GUIDE.md`](docs/MIGRATION_GUIDE.md) · [`docs/CLAUDE_CODE_HANDOFF.md`](docs/CLAUDE_CODE_HANDOFF.md)

---

## 5. Governança

- **Architecture Freeze v1.0** — toda mudança arquitetural exige novo ADR
- **RLS obrigatório** em 100% das tabelas públicas
- **Provider Layer obrigatório** — nenhum consumidor importa SDK externo direto
- **Multi-tenant por `organization_id`** — sem exceção
- **Quality Gate mínimo:** `tsgo --noEmit` limpo + suíte verde

---

## 6. Licença e propriedade

Código proprietário Zenno AI Suite. Todos os direitos reservados.
