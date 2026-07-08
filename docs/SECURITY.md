# Segurança — Zenno SaaS

Documento vivo. Descreve o modelo de segurança operacional do Zenno após Sprint Segurança 2.

## 1. Modelo de acesso

- Backend PostgreSQL com **RLS obrigatório** em 100% das tabelas públicas.
- Isolamento multi-tenant por `organization_id`.
- Funções `SECURITY DEFINER` executam com `search_path = pg_catalog, public` (proteção contra hijacking).
- Segredos apenas no backend (`process.env.*`). Nunca em bundle client.

## 2. Auditoria (audit_log)

Tabela append-only, particionada por mês (`RANGE(created_at)`).

| Campo | Descrição |
| --- | --- |
| `id`, `created_at` | PK composta (necessário em partições). |
| `actor_user_id`, `actor_org_id` | Quem executou a ação. |
| `request_id`, `trace_id` | Correlação com logs estruturados. |
| `ip`, `user_agent` | Contexto da requisição (opcional). |
| `action`, `entity_type`, `entity_id` | Ex: `UPDATE:payment_integrations`. |
| `old_data`, `new_data` | JSONB com **redação automática** de segredos. |

### Regras
- **Sem UPDATE/DELETE** — bloqueado por trigger (`audit_log_block_mutation`).
- Escrita **apenas** via `public.app_write_audit_log(...)` (SECURITY DEFINER, execute apenas para `service_role`).
- Triggers automáticos em: `user_roles`, `payment_integrations`, `meta_ad_accounts`, `google_ad_accounts`, `whatsapp_instances`, `sigma_integrations`, `organizations`.
- Leitura: RLS filtra por `actor_org_id = current_org_id()`.

### Redação
Chaves removidas antes de persistir: `access_token`, `refresh_token`, `token`, `api_key`, `apikey`, `secret`, `password`, `password_hash`, `client_secret`, `webhook_secret`, `service_role_key`, `authorization`, `cookie`.

### Partições e retenção
- 13 partições pré-criadas (mês atual + 12 futuros).
- Nova partição: `SELECT public.audit_log_ensure_partition(DATE '2027-08-01');`
- Retenção alvo: **18 meses**. Descarte de partições antigas por job externo (documentado no `README`).

## 3. Rate Limiting Global

Função reutilizável:
```sql
SELECT public.global_rate_limit_hit(_key => 'oauth:1.2.3.4',
                                    _limit => 20,
                                    _window_seconds => 60);
```
Retorna `true` quando o limite foi **excedido** no bucket alinhado à janela.

Helper server-side: `src/lib/rate-limit.server.ts`.

### Limites em produção

| Contexto | Chave | Limite | Janela |
| --- | --- | ---: | ---: |
| OAuth Meta/Google | `oauth:<ip>` | 20 | 60 s |
| OAuth Meta/Google | `oauth:<state>` | 3 | 60 s |
| WhatsApp webhook | `webhook:<instance_id>` | 600 | 60 s |
| WhatsApp webhook | `webhook:<ip>` | 300 | 60 s |
| Criação de integração | `integration:create:<org>:<user>` | 10 | 60 s |
| Login | `auth:login:<ip>` | 20 | 60 s |
| Login | `auth:login:<email>` | 5 | 60 s |

Rate limit do módulo Tracking permanece separado (`track_rate_limit_hit`) para preservar contratos.

**Fail-open:** Se o RPC falhar, o helper libera a requisição e loga o erro — nunca derruba OAuth/webhook.

## 4. Funções SECURITY DEFINER protegidas

Todas com `SET search_path = pg_catalog, public`:
- `current_org_id`, `has_role`
- `handle_new_user`, `create_default_subscription`
- `track_rate_limit_hit`, `global_rate_limit_hit`
- `app_write_audit_log`, `audit_redact`, `audit_row_change`, `audit_log_ensure_partition`

## 5. Endpoints públicos (`/api/public/*`)

Todos os endpoints públicos DEVEM:
1. Validar assinatura/secret (HMAC ou `webhook_secret` rotacionável).
2. Aplicar rate limit apropriado.
3. Retornar 401/429 sem vazar detalhes internos.
4. Nunca logar tokens, chaves ou PII.

## 6. Compatibilidade

- 100% Postgres puro — sem dependências específicas do Supabase/Lovable.
- Deploy externo (Docker/Coolify/K8s) usa exatamente as mesmas migrations.
- Nenhum contrato público foi alterado nesta sprint.
