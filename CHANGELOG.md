# Changelog

## Sprint 3.5 — Tracking Security Hardening (2026-07-08)

Aditivo. Sem alteração no contrato do payload público de tracking.

### Corrigido

- `/api/public/track/event` agora é **fail-closed**: `tracking_allowed_origins` vazio/nulo bloqueia ingestão pública.
- Requests sem `Origin` e sem `Referer` são rejeitados para impedir ingestão server-to-server anônima.
- CORS do endpoint de eventos não retorna mais wildcard quando não há origem.

### Endurecido

- Allowlist de tracking normalizada em código e migration: lowercase, sem protocolo/caminho, sem duplicatas e sem entradas inválidas.
- Rate limit composto para tracking: por IP + chave pública e por chave pública global, reduzindo abuso distribuído.
- Eventos suspeitos/rejeitados gravam auditoria mínima e sem PII.
- `meta_conversion_events` e `google_ads_conversions` agora possuem triggers de auditoria para conversões originadas do tracking público.

### Testes

- Testes unitários para fail-closed, CORS sem wildcard, normalização de allowlist, wildcard controlado e chaves compostas de rate limit.

## Sprint Arquitetura 3 — Provider Layer (2026-07-08)

Aditivo. Nenhuma alteração em consumers existentes ou APIs públicas.

### Adicionado

- **Camada de providers** em `src/providers/` — interfaces + factories + adapters isolando fornecedores externos.
- `AdsProvider` (`meta`, `google_ads`) — connect/campaigns/insights/conversion/disconnect.
- `WhatsAppProvider` (`uazapi`) — create/status/send/receiveWebhook/disconnect. Preparado para WABA.
- `PaymentProvider` (`stripe`, `mercadopago`) — customer/subscription/checkout/status.
- `AIProvider` (`lovable`) — chat/vision/embeddings/executeAction. Preparado para OpenAI/Anthropic.
- Factories selecionam provider por `ADS_PROVIDER`, `WHATSAPP_PROVIDER`, `PAYMENT_PROVIDER`, `AI_PROVIDER`.
- Erros unificados: `ProviderError`, `ProviderNotConfiguredError`, `UnknownProviderError`, `sanitizeProviderError`.
- Documentação: `docs/ARCHITECTURE.md` com diagrama Provider Layer.

### Notas de migração

- Consumers atuais (`meta-ads.functions`, `google-ads.functions`, `whatsapp.functions`, `copilot`, callbacks OAuth) continuam funcionando inalterados.
- Nova regra em memória: **novas features devem consumir apenas via factory** — SDK de fornecedor não pode ser importado em módulo de domínio.
- Migração dos consumers atuais para as factories é próximo passo incremental (aditivo, sem breaking).

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
