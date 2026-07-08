# Version History — Zenno AI Suite

Histórico consolidado. Datas indicativas; para changelog fino ver
`CHANGELOG.md`.

## Convenção
- **Breaking Change**: exige migração explícita (indicado com ⚠️).
- **Migração**: SQL/config obrigatórios ao subir a versão.

---

## v0.1 — Bootstrap
- **Sprint**: Fundação inicial.
- **Mudanças**: template TanStack Start + Supabase; auth email/senha;
  layout admin básico.
- **Impacto**: primeira versão navegável.
- **Breaking**: n/a.
- **Migração**: schema inicial.

## v0.2 — CRM e Kanban
- **Sprint**: Produto inicial.
- **Mudanças**: `leads`, `organizations`, `user_roles`; Kanban;
  RLS por organization.
- **Impacto**: multi-tenant funcional.
- **Migração**: tabelas de CRM + policies.

## v0.3 — WhatsApp
- **Sprint**: Integração 1.
- **Mudanças**: Uazapi como WhatsAppProvider; webhook `/api/public/whatsapp/webhook/:instanceId`;
  chat em tempo real.
- **Impacto**: canal principal de conversação.
- **Migração**: tabelas `whatsapp_instances`, `whatsapp_messages`.

## v0.4 — Meta Ads + Google Ads
- **Sprint**: Integração 2.
- **Mudanças**: OAuth Meta + Google Ads; sync de campanhas;
  criativos; tracking Meta CAPI e Google OCI.
- **Impacto**: atribuição server-side.
- **Migração**: tabelas `meta_ad_accounts`, `google_ad_accounts`,
  `oauth_states`.

## v0.5 — Financeiro + Payments
- **Sprint**: Financeiro.
- **Mudanças**: categorias, transações, cobranças; integrações
  Stripe / MercadoPago / Asaas.
- **Impacto**: cobrança recorrente.
- **Migração**: tabelas `finance_*`, `subscriptions`, `payment_integrations`.

## v0.6 — IA e Automações
- **Sprint**: IA.
- **Mudanças**: qualificação de leads via Lovable AI; copiloto;
  automações (gatilhos + ações).
- **Migração**: tabelas `ai_copilot_messages`, `automations`.

## v0.7 — Sprint Infra 1
- Docker, compose, healthchecks, logger estruturado.
- **Migração**: nenhuma no banco.

## v0.8 — Sprint Segurança 2
- `audit_log` particionado append-only, rate limit function,
  `search_path` fixo em SECURITY DEFINER.
- ⚠️ **Breaking**: SQL antigo que dependia de `search_path` mutável pode quebrar.
- **Migração**: partições do `audit_log`, função `global_rate_limit_hit`.

## v0.9 — Sprint Arquitetura 3
- Provider Layer formalizada.
- **Impacto**: consumidores dependem de interface.
- **Migração**: nenhuma no banco.

## v0.9.5 — Sprint 3.5
- Segurança em profundidade (fuzzing, tenant leakage, tracking).
- **Migração**: nenhuma no banco.

## v0.10 — Sprint 4 (WS-7/8/9/10)
- 313 testes: integration/db, contracts, security.
- CI GitHub Actions (typecheck → test → coverage → build → audit).
- **Migração**: nenhuma no banco.

## v0.11 — Sprint Staging Enterprise (WS-0.x)
- Documentação Enterprise completa (release, staging, deploy, prod
  readiness, ADRs, handbook, runbooks, DR, incident response).
- **Migração**: nenhuma.
- **Impacto**: destrava operação em Staging Enterprise.

## v1.0-RC — Alvo pós-Sprint 5
- Sentry + coletor externo de logs + retenção de partições +
  drill de rollback.
- Requer `SENTRY_DSN` no cofre.
- **Migração**: job de retenção do `audit_log`.

## v1.0 — Alvo pós-Sprint 7
- READY FOR PRODUCTION oficial.
- SLO/SLA + compliance LGPD/GDPR + página de status.
- **Migração**: fluxo de esquecimento + retenção formalizada.

---

## Compatibilidade

| De | Para | Compatível? | Ação |
|----|------|-------------|------|
| 0.7 → 0.8 | | ⚠️ | Aplicar migrations de partição + revisar SECURITY DEFINER |
| 0.9 → 0.10 | | ✅ | Sem breaking |
| 0.10 → 0.11 | | ✅ | Apenas docs |
| 0.11 → 1.0-RC | | ✅ | Configurar Sentry + coletor logs |
| 1.0-RC → 1.0 | | ⚠️ | Compliance requer políticas assinadas |
