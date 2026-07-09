# Zenno AI Suite — Product Backlog Enterprise

**Versão:** 1.0
**Data:** 2026-07-09
**Modo:** Product Evolution (pós Architecture Freeze v1.0)
**Escopo:** roadmap de features aditivas sobre baseline congelada. Nenhuma
alteração de arquitetura, RLS, Provider Layer ou contratos públicos é
implicada por este documento.

**Convenções:**
- **Prioridade:** P0 essencial · P1 alta · P2 média · P3 futuro
- **Complexidade:** S (≤1 sprint) · M (2–3) · L (4–6) · XL (7+)
- **Impacto $:** 🟢 alto (receita direta) · 🟡 médio (retenção/expansão) · 🔵 baixo (habilitador)
- **Risco:** 🔴 alto · 🟠 médio · 🟢 baixo
- **Sprint:** unidade de estimativa (uma sprint ≈ 1–2 semanas-dev)

---

## Módulo 1 — Billing 🟢

**Objetivo:** monetizar o SaaS com cobrança recorrente confiável e multi-provedor.
**Valor cliente:** contratação/pagamento sem fricção, upgrade instantâneo, faturas fiscais.
**Impacto negócio:** MRR/ARR direto, redução de churn involuntário.
**Dependências:** Provider Layer de payments (Stripe/MercadoPago já existentes).

| # | Feature | Prio | Complex | Sprints | Impacto $ | Risco |
|---|---------|------|---------|---------|-----------|-------|
| 1.1 | Planos & Assinaturas (CRUD + tabela `plans`) | P0 | M | 2 | 🟢 | 🟠 |
| 1.2 | Checkout Stripe (usando provider existente) | P0 | M | 2 | 🟢 | 🟠 |
| 1.3 | Checkout MercadoPago + PIX | P0 | M | 2 | 🟢 | 🟠 |
| 1.4 | Trial 15d (já existe em `subscriptions`) → UI + expiração | P0 | S | 1 | 🟡 | 🟢 |
| 1.5 | Upgrade / Downgrade proporcional | P1 | M | 2 | 🟢 | 🟠 |
| 1.6 | Faturas (PDF, NFS-e via provedor externo) | P1 | L | 3 | 🟡 | 🟠 |
| 1.7 | Cobrança recorrente + retry (dunning) | P1 | M | 2 | 🟢 | 🟠 |
| 1.8 | Gestão de inadimplência (suspender, notificar) | P1 | M | 2 | 🟢 | 🟠 |
| 1.9 | Cupons e descontos | P2 | S | 1 | 🟡 | 🟢 |
| 1.10 | Cashback / créditos | P2 | M | 2 | 🟡 | 🟠 |
| 1.11 | Webhook signature verify (Stripe/MP) endurecido | P0 | S | 1 | 🔵 | 🟢 |
| 1.12 | Portal de cobrança do cliente (self-service) | P1 | M | 2 | 🟡 | 🟢 |

**Total módulo:** 12 features · ~22 sprints.

---

## Módulo 2 — Portal do Cliente 🟡

**Objetivo:** onboarding, gestão de organização e conformidade.
**Valor cliente:** autonomia; time colaborando com papéis claros.
**Impacto negócio:** ativação, expansão por seats, compliance.
**Dependências:** `user_roles`, `organizations`, `audit_log` (já existentes).

| # | Feature | Prio | Complex | Sprints | Impacto $ | Risco |
|---|---------|------|---------|---------|-----------|-------|
| 2.1 | Dashboard inicial da org | P0 | S | 1 | 🔵 | 🟢 |
| 2.2 | Perfil do usuário (foto, nome, senha, MFA) | P0 | S | 1 | 🔵 | 🟢 |
| 2.3 | Gestão da Organização (nome, timezone, moeda) | P0 | S | 1 | 🔵 | 🟢 |
| 2.4 | Equipe + convites por email | P0 | M | 2 | 🟡 | 🟠 |
| 2.5 | Papéis (owner/admin/member/viewer) | P0 | M | 2 | 🟡 | 🟠 |
| 2.6 | API Keys por org (scopes) | P1 | M | 2 | 🟢 | 🟠 |
| 2.7 | Personal Access Tokens | P2 | S | 1 | 🔵 | 🟢 |
| 2.8 | Configurações gerais (notificações, defaults) | P1 | S | 1 | 🔵 | 🟢 |
| 2.9 | Segurança (sessions, dispositivos, MFA obrigatório) | P1 | M | 2 | 🟡 | 🟠 |
| 2.10 | Visualização de auditoria (leitura do `audit_log`) | P1 | S | 1 | 🟡 | 🟢 |

**Total módulo:** 10 features · ~14 sprints.

---

## Módulo 3 — Analytics 🟢

**Objetivo:** transformar dados brutos em decisão executiva.
**Valor cliente:** ROI transparente, decisões orçamentárias defensáveis.
**Impacto negócio:** justifica ticket alto, prova de valor recorrente.
**Dependências:** `tracking_events`, `tracking_leads`, `meta_ads_insights`, `google_ads_insights`.

| # | Feature | Prio | Complex | Sprints | Impacto $ | Risco |
|---|---------|------|---------|---------|-----------|-------|
| 3.1 | Dashboard Executivo (receita, CAC, LTV, ROAS) | P0 | L | 3 | 🟢 | 🟠 |
| 3.2 | CAC por canal | P0 | M | 2 | 🟢 | 🟠 |
| 3.3 | LTV por cohort | P1 | L | 3 | 🟢 | 🟠 |
| 3.4 | ROI / ROAS por campanha | P0 | M | 2 | 🟢 | 🟠 |
| 3.5 | Funil de conversão | P0 | M | 2 | 🟢 | 🟠 |
| 3.6 | Attribution multi-touch (first/last/linear) | P1 | L | 4 | 🟢 | 🔴 |
| 3.7 | Cohort de retenção | P1 | M | 2 | 🟡 | 🟠 |
| 3.8 | Curva de retenção | P1 | S | 1 | 🟡 | 🟢 |
| 3.9 | KPIs configuráveis por org | P2 | M | 2 | 🟡 | 🟠 |
| 3.10 | Exportação PDF | P1 | M | 2 | 🟡 | 🟠 |
| 3.11 | Exportação Excel/CSV | P1 | S | 1 | 🟡 | 🟢 |
| 3.12 | Agendamento de relatórios por email | P2 | M | 2 | 🟡 | 🟠 |

**Total módulo:** 12 features · ~26 sprints.

---

## Módulo 4 — Marketing 🟢

**Objetivo:** consolidar aquisição paga num único cockpit.
**Valor cliente:** menos abas, mais controle, dedup de conversões.
**Impacto negócio:** cross-sell entre canais, retenção alta.
**Dependências:** Provider Layer ads (Meta/Google já existentes).

| # | Feature | Prio | Complex | Sprints | Impacto $ | Risco |
|---|---------|------|---------|---------|-----------|-------|
| 4.1 | Meta Ads — gestão de campanhas (já parcial) | P0 | M | 2 | 🟢 | 🟠 |
| 4.2 | Google Ads — gestão de campanhas (já parcial) | P0 | M | 2 | 🟢 | 🟠 |
| 4.3 | TikTok Ads (novo provider no factory) | P1 | L | 4 | 🟢 | 🟠 |
| 4.4 | LinkedIn Ads (novo provider no factory) | P2 | L | 4 | 🟡 | 🟠 |
| 4.5 | Google Analytics 4 integração | P1 | M | 2 | 🟡 | 🟠 |
| 4.6 | GTM helper / snippet manager | P2 | M | 2 | 🔵 | 🟢 |
| 4.7 | Pixel Manager unificado | P1 | M | 2 | 🟡 | 🟠 |
| 4.8 | Conversões Offline (CAPI Meta / OCI Google) | P0 | L | 3 | 🟢 | 🟠 |
| 4.9 | Comparativo cross-channel | P1 | M | 2 | 🟢 | 🟠 |

**Total módulo:** 9 features · ~23 sprints.

---

## Módulo 5 — IA 🟢

**Objetivo:** diferencial competitivo com insights acionáveis.
**Valor cliente:** economia real via detecção de desperdício.
**Impacto negócio:** upsell de plano AI, retenção.
**Dependências:** Lovable AI Gateway (já configurado), Provider Layer AI.

| # | Feature | Prio | Complex | Sprints | Impacto $ | Risco |
|---|---------|------|---------|---------|-----------|-------|
| 5.1 | Copiloto conversacional (já parcial em `ai_copilot_*`) | P0 | L | 3 | 🟢 | 🟠 |
| 5.2 | Insights automáticos diários | P0 | M | 2 | 🟢 | 🟠 |
| 5.3 | Sugestões de otimização de campanha | P0 | L | 3 | 🟢 | 🟠 |
| 5.4 | Diagnóstico de conta (health score) | P1 | M | 2 | 🟡 | 🟠 |
| 5.5 | Automações condicionais (if-then-else) | P1 | L | 4 | 🟢 | 🔴 |
| 5.6 | Detecção de desperdício de verba | P0 | L | 3 | 🟢 | 🟠 |
| 5.7 | Recomendações de budget | P1 | M | 2 | 🟢 | 🟠 |
| 5.8 | Score de campanhas (0–100) | P1 | M | 2 | 🟡 | 🟠 |
| 5.9 | Qualificação automática de leads | P1 | M | 2 | 🟡 | 🟠 |

**Total módulo:** 9 features · ~23 sprints.

---

## Módulo 6 — WhatsApp 🟢

**Objetivo:** canal de atendimento e nurturing integrado ao CRM.
**Valor cliente:** conversas atreladas a leads/campanhas com atribuição.
**Impacto negócio:** feature "match" para PMEs BR; alta retenção.
**Dependências:** provider uazapi já existente; migrar/adicionar Cloud API.

| # | Feature | Prio | Complex | Sprints | Impacto $ | Risco |
|---|---------|------|---------|---------|-----------|-------|
| 6.1 | WhatsApp Cloud API (provider Meta oficial) | P0 | L | 4 | 🟢 | 🔴 |
| 6.2 | Gestão de templates (HSM) | P0 | M | 2 | 🟡 | 🟠 |
| 6.3 | Broadcast segmentado | P1 | L | 3 | 🟢 | 🟠 |
| 6.4 | Chat multi-agente (já parcial) | P0 | L | 3 | 🟢 | 🟠 |
| 6.5 | Fila de atendimento + SLA | P1 | M | 2 | 🟡 | 🟠 |
| 6.6 | Chatbot por fluxo (drag-and-drop) | P1 | XL | 6 | 🟢 | 🔴 |
| 6.7 | Fluxos condicionais + integrações | P1 | L | 4 | 🟢 | 🔴 |
| 6.8 | CRM integrado (leads ↔ conversas) | P0 | M | 2 | 🟢 | 🟠 |
| 6.9 | Tags e macros | P2 | S | 1 | 🔵 | 🟢 |
| 6.10 | Métricas de atendimento (TMR, TMA, CSAT) | P1 | M | 2 | 🟡 | 🟠 |

**Total módulo:** 10 features · ~29 sprints.

---

## Módulo 7 — API Pública 🟡

**Objetivo:** habilitar ecossistema e integrações do cliente.
**Valor cliente:** automatização própria, integração com stack.
**Impacto negócio:** stickiness alto, plano Enterprise.
**Dependências:** API keys (Módulo 2.6), OpenAPI, versionamento.

| # | Feature | Prio | Complex | Sprints | Impacto $ | Risco |
|---|---------|------|---------|---------|-----------|-------|
| 7.1 | REST API v1 (leads, campanhas, conversões) | P0 | L | 4 | 🟢 | 🟠 |
| 7.2 | OpenAPI 3.1 spec + docs interativa | P0 | M | 2 | 🟡 | 🟢 |
| 7.3 | Webhooks outbound (eventos assináveis) | P0 | L | 3 | 🟢 | 🟠 |
| 7.4 | SDK JavaScript/TypeScript | P1 | M | 2 | 🟡 | 🟢 |
| 7.5 | SDK Python | P2 | M | 2 | 🔵 | 🟢 |
| 7.6 | SDK PHP | P3 | M | 2 | 🔵 | 🟢 |
| 7.7 | SDK Node (server-side dedicado) | P2 | S | 1 | 🔵 | 🟢 |
| 7.8 | OAuth Apps (3-legged, para partners) | P2 | XL | 6 | 🟡 | 🔴 |
| 7.9 | Rate limit por API key (já há infra) | P0 | S | 1 | 🔵 | 🟢 |

**Total módulo:** 9 features · ~23 sprints.

---

## Módulo 8 — Mobile 🟡

**Objetivo:** acesso em mobilidade sem sair do stack web.
**Valor cliente:** dashboards no bolso, notificações.
**Impacto negócio:** engajamento diário, retenção.
**Dependências:** app já é web-first; PWA é caminho natural.

| # | Feature | Prio | Complex | Sprints | Impacto $ | Risco |
|---|---------|------|---------|---------|-----------|-------|
| 8.1 | PWA (manifest, service worker restrito) | P1 | M | 2 | 🟡 | 🟠 |
| 8.2 | Push Notifications (Web Push) | P1 | M | 2 | 🟡 | 🟠 |
| 8.3 | Modo offline (leitura de dashboards) | P2 | L | 3 | 🔵 | 🟠 |
| 8.4 | App Android (Capacitor wrapper) | P2 | L | 4 | 🔵 | 🟠 |
| 8.5 | App iOS (Capacitor wrapper) | P2 | L | 4 | 🔵 | 🟠 |
| 8.6 | Deep links + universal links | P2 | M | 2 | 🔵 | 🟠 |

**Total módulo:** 6 features · ~17 sprints.

---

## Módulo 9 — Enterprise 🟢

**Objetivo:** habilitar contratos B2B grandes.
**Valor cliente:** compliance, SSO corporativo, escala regional.
**Impacto negócio:** ticket 5–20× o self-service.
**Dependências:** RBAC existente, `has_role`, novo ADR para SSO.

| # | Feature | Prio | Complex | Sprints | Impacto $ | Risco |
|---|---------|------|---------|---------|-----------|-------|
| 9.1 | White Label (tema/logo/domínio por org) | P1 | L | 3 | 🟢 | 🟠 |
| 9.2 | Multi idioma (i18n PT/EN/ES) | P1 | L | 3 | 🟡 | 🟠 |
| 9.3 | Multi moeda | P2 | M | 2 | 🟡 | 🟠 |
| 9.4 | Multi região (data residency) | P3 | XL | 8 | 🟡 | 🔴 |
| 9.5 | SSO SAML (via `supabase--configure_saml_sso`) | P1 | M | 2 | 🟢 | 🟠 |
| 9.6 | SSO OIDC | P2 | M | 2 | 🟡 | 🟠 |
| 9.7 | LDAP (via IdP intermediário) | P3 | L | 3 | 🔵 | 🟠 |
| 9.8 | SCIM 2.0 (provisionamento automático) | P2 | L | 4 | 🟡 | 🔴 |
| 9.9 | RBAC avançado (permissions granulares) | P1 | L | 3 | 🟡 | 🟠 |
| 9.10 | Auditoria exportável (SIEM, S3) | P2 | M | 2 | 🟡 | 🟠 |

**Total módulo:** 10 features · ~32 sprints.

---

## Módulo 10 — Marketplace 🟡

**Objetivo:** ecossistema de terceiros como moat.
**Valor cliente:** extensibilidade sem esperar roadmap oficial.
**Impacto negócio:** network effect, revenue share.
**Dependências:** API Pública (Módulo 7), OAuth Apps (7.8).

| # | Feature | Prio | Complex | Sprints | Impacto $ | Risco |
|---|---------|------|---------|---------|-----------|-------|
| 10.1 | Catálogo de integrações (curadas) | P2 | M | 2 | 🟡 | 🟠 |
| 10.2 | Framework de Plugins (sandbox) | P3 | XL | 8 | 🟡 | 🔴 |
| 10.3 | Extensões UI (slots) | P3 | XL | 6 | 🔵 | 🔴 |
| 10.4 | API Apps (partners publicando) | P3 | L | 4 | 🟡 | 🔴 |
| 10.5 | Billing Apps (revenue share) | P3 | L | 4 | 🟢 | 🔴 |
| 10.6 | Diretório público de apps | P3 | M | 2 | 🔵 | 🟠 |

**Total módulo:** 6 features · ~26 sprints.

---

## Consolidação

- **Módulos:** 10
- **Features totais:** 93
- **Sprints estimadas (soma bruta):** ~235 (ordem de grandeza, não linear)

### Distribuição por prioridade

| Prio | Contagem | % |
|------|----------|---|
| P0 | 22 | 24% |
| P1 | 39 | 42% |
| P2 | 22 | 24% |
| P3 | 10 | 11% |

### Distribuição por impacto financeiro

| Impacto | Contagem |
|---------|----------|
| 🟢 Alto | 36 |
| 🟡 Médio | 39 |
| 🔵 Baixo | 18 |

---

## Roadmap sugerido por versão

### v1.1 — "Monetização + Portal" (foco: gerar receita self-service)
- Módulo 1: 1.1, 1.2, 1.3, 1.4, 1.7, 1.11
- Módulo 2: 2.1–2.5, 2.10
- Módulo 3: 3.1, 3.5
- **Objetivo:** cliente contrata sozinho, paga sozinho, vê valor no dia 1.

### v1.2 — "Analytics + Marketing core"
- Módulo 3: 3.2, 3.4, 3.6, 3.10, 3.11
- Módulo 4: 4.1, 4.2, 4.8
- Módulo 5: 5.1, 5.2, 5.6
- **Objetivo:** provar ROI e reduzir desperdício com IA.

### v1.3 — "WhatsApp + CRM"
- Módulo 6: 6.1, 6.2, 6.4, 6.8
- Módulo 2: 2.6, 2.9
- Módulo 5: 5.3, 5.9
- **Objetivo:** fechar o ciclo lead → conversa → conversão.

### v2.0 — "Plataforma extensível"
- Módulo 7: 7.1, 7.2, 7.3, 7.4, 7.9
- Módulo 8: 8.1, 8.2
- Módulo 1: 1.5, 1.6, 1.8, 1.12
- Módulo 4: 4.3, 4.5, 4.7
- Módulo 6: 6.3, 6.5, 6.6, 6.10
- **Objetivo:** virar plataforma, não produto.

### v2.0 Enterprise — "Contratos B2B grandes"
- Módulo 9: 9.1, 9.2, 9.5, 9.6, 9.9, 9.10
- Módulo 7: 7.8
- Módulo 9: 9.8
- Módulo 3: 3.3, 3.7, 3.9, 3.12
- Módulo 2: 2.7, 2.8
- **Objetivo:** unlock de contas Enterprise + compliance.

### v3.0 — "Ecossistema" (futuro)
- Módulo 10 completo
- Módulo 8: 8.3–8.6
- Módulo 9: 9.3, 9.4, 9.7
- Módulo 7: 7.5, 7.6, 7.7

---

## Dependências críticas

1. **Billing (1.1–1.4) precede tudo** — sem receita, nada se sustenta.
2. **API Keys (2.6) bloqueia API Pública (Módulo 7).**
3. **API Pública (7.1) bloqueia Marketplace (Módulo 10) e SDKs (7.4–7.7).**
4. **WhatsApp Cloud API (6.1) precede templates, chatbot e broadcast (6.2, 6.3, 6.6).**
5. **RBAC avançado (9.9) precede SCIM (9.8).**
6. **SSO SAML (9.5) precede SCIM (9.8) em maioria dos IdPs.**
7. **Conversões offline (4.8) precede attribution multi-touch (3.6).**
8. **Dashboard executivo (3.1) precede exportação (3.10, 3.11) e agendamento (3.12).**

---

## Features de maior valor para o negócio (top 10)

Ranking por impacto $ × probabilidade de execução × dependência baixa:

1. **1.2 Checkout Stripe** — porta de entrada de receita.
2. **1.3 Checkout MercadoPago + PIX** — mercado BR (SMB).
3. **3.1 Dashboard Executivo** — prova de valor imediata.
4. **5.6 Detecção de desperdício de verba** — ROI mensurável do produto.
5. **4.8 Conversões Offline** — desbloqueia atribuição correta.
6. **6.1 WhatsApp Cloud API** — canal #1 no BR.
7. **5.1 Copiloto conversacional** — diferencial competitivo.
8. **9.1 White Label** — abre canal de revenda.
9. **7.1 REST API v1** — stickiness e integração corporativa.
10. **1.8 Gestão de inadimplência** — reduz churn involuntário (5–8% MRR).

---

## Riscos macro

- **R-P1** — Escopo de Módulo 6 (WhatsApp Cloud API) exige aprovação Meta para HSM; time-to-market alto.
- **R-P2** — Marketplace (Módulo 10) requer sandbox seguro (WASM/iframe isolado); alto custo/beneficio incerto até haver base instalada.
- **R-P3** — Multi-região (9.4) impacta data residency; exige novo ADR e possivelmente múltiplos projetos Supabase.
- **R-P4** — Attribution multi-touch (3.6) tem complexidade estatística; risco de números "diferentes" do GA/Meta gerar suporte.

---

## Ordem recomendada de implementação (primeiras 8 features)

1. 1.11 Webhook signature hardening (habilitador) — S
2. 1.1 Planos & Assinaturas — M
3. 1.2 Checkout Stripe — M
4. 1.3 Checkout MercadoPago + PIX — M
5. 1.4 Trial UI + expiração — S
6. 2.4 Equipe + convites — M
7. 2.5 Papéis — M
8. 3.1 Dashboard Executivo — L

**Justificativa:** habilita monetização recorrente e colaboração antes de qualquer expansão funcional.

---

## Governança

- Toda feature deste backlog é **aditiva** sobre Architecture Freeze v1.0.
- Nenhuma feature altera: ADRs aceitos, RLS, Provider Layer, contratos públicos existentes, endpoints existentes.
- Novos endpoints, tabelas e providers seguem o handbook: RLS obrigatório, GRANTs explícitos, testes de contrato, redação em audit, observabilidade via catálogo, testes ≥ passing 313/313 mais os novos.
- Cada feature aprovada gera: ADR (se decisão arquitetural), migration (se schema), testes (unit + integration + contract), documentação mínima no módulo, entrada no CHANGELOG.

---

**Backlog v1.0 encerrado. Aguardando aprovação para iniciar a primeira FEATURE do roadmap (sugestão: 1.11 → 1.1 → 1.2).**
