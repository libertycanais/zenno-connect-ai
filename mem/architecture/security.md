---
name: Segurança operacional Zenno
description: Modelo de segurança pós-Sprint 2 — audit_log append-only particionado, global_rate_limit_hit, SECURITY DEFINER com search_path fixo, redação de segredos
type: feature
---

# Segurança operacional — Sprint Segurança 2

## Audit log (append-only)
- `public.audit_log` particionado por mês (RANGE em `created_at`), PK composta `(id, created_at)`.
- Escrita **apenas** via `public.app_write_audit_log(...)` (SECURITY DEFINER, execute só p/ service_role).
- Triggers `trg_audit_<table>` chamam `audit_row_change()` em: `user_roles`, `payment_integrations`, `meta_ad_accounts`, `google_ad_accounts`, `whatsapp_instances`, `sigma_integrations`, `organizations`.
- UPDATE/DELETE bloqueados por `audit_log_block_mutation`.
- Leitura via RLS: `actor_org_id = current_org_id()`.
- Redação de segredos automática (`audit_redact`): access_token, refresh_token, token, api_key, secret, password, client_secret, webhook_secret, service_role_key, authorization, cookie.
- Retenção alvo: 18 meses. Novas partições via `SELECT public.audit_log_ensure_partition(DATE '…')`.

## Rate limit global
- Função: `public.global_rate_limit_hit(_key text, _limit int, _window_seconds int)` → true quando excedido.
- Tabela `global_rate_limits` (sem policies; acesso só via função SECURITY DEFINER).
- Helper server: `@/lib/rate-limit.server` → `rateLimitHit(key, limit, windowSec)`, `clientIp(req)`, `tooManyRequests(retryAfter)`. **Fail-open** — nunca derruba tráfego se RPC falhar.
- Aplicado em: Meta OAuth callback, Google Ads OAuth callback, WhatsApp webhook.
- Chaves padrão: `oauth:<ip>` (20/min), `oauth:<state>` (3/min), `webhook:<instance_id>` (600/min), `webhook:<ip>` (300/min), `integration:create:<org>:<user>` (10/min), `auth:login:<ip>` (20/min), `auth:login:<email>` (5/min).
- Tracking mantém `track_rate_limit_hit` próprio — não migrar sem revisão.

## SECURITY DEFINER hardening
Todas as funções privilegiadas usam `SET search_path = pg_catalog, public`:
`current_org_id`, `has_role`, `handle_new_user`, `create_default_subscription`, `track_rate_limit_hit`, `touch_updated_at`, `global_rate_limit_hit`, `app_write_audit_log`, `audit_redact`, `audit_row_change`, `audit_log_ensure_partition`.

## Ao adicionar nova feature
- Toda nova tabela sensível → adicionar trigger `audit_row_change`.
- Todo novo endpoint público (`/api/public/*`) → aplicar `rateLimitHit` antes da lógica.
- Toda nova SECURITY DEFINER → obrigatório `SET search_path = pg_catalog, public` (ou schemas mínimos).
- Nunca logar tokens/PII; usar `logger.ts` que já redige.
