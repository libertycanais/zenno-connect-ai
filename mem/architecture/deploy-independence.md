---
name: Arquitetura de deploy independente Zenno
description: Regras arquiteturais obrigatórias — Lovable como dev, infra externa em produção. Portabilidade, env-vars, camadas de abstração, segurança, observabilidade
type: constraint
---

# Diretriz — Zenno SaaS (Lovable dev / infra externa)

## 1. Independência de infraestrutura
- Todo código deve rodar fora do Lovable.
- Zero dependências exclusivas de plataforma.
- Configuração via env vars: URLs, chaves API, tokens, credenciais, endpoints, configs de serviços.
- Proibido: valores fixos no código.

## 2. Compatibilidade de deploy
Docker, Docker Compose, Cloudflare Workers, Coolify, Railway, Render, Fly.io, AWS, GCP, DigitalOcean.
Separação: Frontend → Backend/API → Postgres → Redis/BullMQ → Serviços externos.

## 3. Banco de dados
- PostgreSQL padrão, desacoplado.
- Migrations versionadas em `supabase/migrations/` — devem funcionar em qualquer Postgres compatível.
- Manter: RLS, policies, functions, triggers, índices, constraints.

## 4. Backend (TanStack Start)
- Server Functions (`createServerFn` + `requireSupabaseAuth`) para app-internal.
- Server routes (`/api/public/*`) para webhooks/APIs públicas — sempre validadas.
- Código server-only nunca no client bundle.
- Segredos apenas no backend. Funções internas autenticadas.

## 5. Integrações externas — camada de abstração
Toda integração (Meta Ads, Google Ads, WhatsApp/Uazapi, pagamentos Asaas/MP/Stripe, IA, webhooks) deve ter interface própria que permita trocar provider.
Padrão: `Provider Interface` → `MetaProvider | GoogleProvider | WhatsAppProvider | PaymentProvider`.

## 6. Infraestrutura (backlog documentado)
- Dockerfile
- docker-compose.yml
- Doc de deploy (já existe `DEPLOYMENT.md`)
- Env vars documentadas
- Health checks
- Logs estruturados

## 7. Segurança (estado atual — manter)
- RLS em 100% das tabelas públicas.
- Multi-tenant por `organization_id`.
- SECURITY DEFINER com `search_path` fixo.
- Tokens apenas no backend.
- OAuth com `state`/`nonce` em `oauth_states`.
- Webhooks protegidos (HMAC + `webhook_secret` rotacionável).
- Rate limit (`global_rate_limit_hit` no backlog).
- Auditoria (`audit_log` particionado no backlog).

## 8. Observabilidade
- Logs estruturados.
- Métricas, health endpoints, monitoramento, alertas.
- Compatível com Prometheus, Grafana, OpenTelemetry.

## 9. Versionamento
- GitHub como fonte da verdade.
- Commits organizados, migrations versionadas, README + docs técnicas atualizados.
- Nunca alterar manualmente arquivos gerados automaticamente.

## 10. Objetivo final
SaaS empresarial escalável, código proprietário, deploy independente, infra substituível, sem lock-in, pronto para milhares de organizações.

## Checklist antes de qualquer feature nova
- [ ] Usa env vars (sem hardcode)?
- [ ] Roda fora do Lovable sem alteração?
- [ ] Migração portável (Postgres puro)?
- [ ] RLS + multi-tenant respeitados?
- [ ] Integração externa passa por camada de abstração?
- [ ] Segredos só no backend?
- [ ] Endpoint público tem validação (HMAC/Zod)?
- [ ] Logs estruturados adicionados?
