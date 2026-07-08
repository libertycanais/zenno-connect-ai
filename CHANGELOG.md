# Changelog

## Sprint Segurança 2 — Hardening (2026-07-08)

Aditivo. Sem breaking changes. Sem alterações em contratos públicos.

### Adicionado
- **Audit log enterprise** (`audit_log`) — append-only, particionado por mês, 13 partições pré-provisionadas, redação automática de segredos.
- Função `public.app_write_audit_log(...)` — único ponto de escrita, SECURITY DEFINER.
- Função `public.audit_log_ensure_partition(date)` — provisionamento incremental.
- Trigger `audit_row_change()` ativado em: `user_roles`, `payment_integrations`, `meta_ad_accounts`, `google_ad_accounts`, `whatsapp_instances`, `sigma_integrations`, `organizations`.
- **Rate limit global** — tabela `global_rate_limits` + função `global_rate_limit_hit(key, limit, window_seconds)`.
- Helper `src/lib/rate-limit.server.ts` (fail-open).
- Rate limit aplicado em: Meta OAuth callback, Google Ads OAuth callback, WhatsApp webhook.
- Documentação: `docs/SECURITY.md`.

### Endurecido
- `search_path = pg_catalog, public` em todas as SECURITY DEFINER existentes: `current_org_id`, `has_role`, `handle_new_user`, `create_default_subscription`, `track_rate_limit_hit`, `touch_updated_at`.

### Preservado
- Todas as policies RLS existentes.
- Todos os endpoints públicos e assinaturas de server functions.
- Comportamento funcional de tracking (rate limit próprio inalterado).
- Compatibilidade Lovable + deploy externo (Docker/Coolify/K8s).

## Sprint Infra 1 — Portabilidade (anterior)
- Dockerfile multi-stage, `docker-compose.yml`, `.dockerignore`.
- Health checks: `/api/public/health`, `/live`, `/ready`.
- Logs JSON estruturados (`src/lib/logger.ts`) com redação automática.
- Documentação: `docs/DOCKER.md`.
